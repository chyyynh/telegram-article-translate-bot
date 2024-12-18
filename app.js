const axios = require("axios"); // 發送 HTTP 請求
const cheerio = require("cheerio"); // 解析 HTML
const { Telegraf } = require("telegraf"); // Telegram Bot API
require("dotenv").config(); // 載入環境變數

// 設置 telegram API
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// 設置 HackMD API Token 和 API URL
const HACKMD_API_URL = "https://api.hackmd.io/v1/teams/funblocks/notes";
const HACKMD_API_TOKEN = process.env.HACKMD_API_TOKEN; // HackMD API Token

const AZURE_API_URL = "https://api.cognitive.microsofttranslator.com/"; // 端點
const AZURE_API_KEY = process.env.AZURE_API_KEY; // 在此填入你的 API key

async function translateWithAzure(text) {
  const url = `${AZURE_API_URL}/translate?api-version=3.0&from=en&to=zh-Hant`;

  try {
    const response = await axios({
      method: "post",
      url: url,
      headers: {
        "Ocp-Apim-Subscription-Key": AZURE_API_KEY,
        "Ocp-Apim-Subscription-Region": "eastasia", // 必須設定
        "Content-Type": "application/json",
      },
      data: [
        {
          Text: text,
        },
      ],
    });

    const translation = response.data[0].translations[0].text;
    console.log(`翻譯結果: ${translation} \n`);
    return translation;
  } catch (error) {
    console.error("翻譯失敗:", error);
    return null;
  }
}

function formatTitle(title) {
  return title
    .toLowerCase() // 轉成小寫
    .replace(/[^\w\s]/g, "") // 移除標點符號 (保留字母、數字和空白)
    .replace(/\s+/g, "-"); // 將空格轉成 "-"
}

async function fetchArticleContent(url) {
  try {
    const response = await axios.get(url);
    const html = response.data;
    const $ = cheerio.load(html);

    // Create an array to hold the mixed content (text and images)
    const contentArray = [];

    // Get the title and convert to Markdown header
    const title = $("title").text();
    const Title = `# ${title} ${await translateWithAzure(title)} \n\n`; // Markdown 標題

    const metadata = [
      `---\n`,
      `title: "${await translateWithAzure(title)}"\n`,
      `author: ""\n`,
      `translateBy: ""\n`,
      `publishedAt: ""\n`,
      `image: ""\n`,
      `link: "${formatTitle(title)}"\n`,
      `summary: ""\n`,
      `OrginalLink: "${url}"\n`,
      `---\n\n`,
    ];

    const articleLink = `原文連結: ${url}`;

    // 抓取所有段落和圖片，按出現順序加入
    const elements = $("p, img"); // 將選取的元素儲存到一個變數中
    for (let element of elements) {
      if ($(element).is("p")) {
        contentArray.push($(element).text());
        const translatedText = await translateWithAzure($(element).text());
        console.log(translatedText);
        contentArray.push(translatedText);
      } else if ($(element).is("img")) {
        if (
          !$(element).hasClass("social-image") &&
          !$(element).hasClass("navbar-logo") &&
          !$(element).hasClass("_1sjywpl0 bc5nci19k bc5nci4t0 bc5nci4ow") // mirror pfp
        ) {
          let imgSrc = $(element).attr("src");
          const imgId = $(element).attr("id");
          const imgAlt = $(element).attr("alt");

          // 處理相對路徑
          if (imgSrc && !imgSrc.startsWith("http")) {
            imgSrc = new URL(imgSrc, url).href; // 將相對路徑轉換為絕對路徑
          }

          if (imgSrc) {
            contentArray.push(`![Image](${imgSrc})`); // Markdown 格式圖片
          }
        }
      }
    }

    // 將混合的內容用兩個換行符號分隔，組織成 Markdown 格式
    const fullContent = `${metadata.join(
      ""
    )}${Title}${articleLink}${contentArray.join("\n\n")}`;

    // 返回最終的 Markdown 內容
    return { title: title, content: fullContent };
  } catch (error) {
    console.error("抓取失敗:", error);
  }
}

async function postToHackMD(title, content) {
  try {
    const response = await axios.post(
      HACKMD_API_URL,
      {
        title: title,
        content: content,
        readPermission: "owner",
        writePermission: "owner",
        commentPermission: "everyone",
      },
      {
        headers: {
          Authorization: `Bearer ${HACKMD_API_TOKEN}`,
        },
      }
    );

    // console.log(response);

    if (response.data && response.data.publishLink) {
      return `筆記已成功發佈！查看連結：${response.data.publishLink}`;
    } else {
      return "發佈到 HackMD 失敗，請稍後再試。";
    }
  } catch (error) {
    console.error("發佈到 HackMD 失敗:", error);
  }
}

// 處理 Telegram Bot 發送的訊息
bot.on("text", async (ctx) => {
  const url = ctx.message.text;

  // 檢查是否為有效的網址
  if (isValidUrl(url)) {
    ctx.reply("正在抓取文章，請稍候...");

    const articleData = await fetchArticleContent(url);
    const duplicatedlink = await isArticleUploaded(articleData.title);
    if (duplicatedlink != 0) {
      ctx.reply(`已上傳過本篇文章，文章連結: ${duplicatedlink}`);
    } else if (articleData && articleData.content) {
      // 將文章發佈到 HackMD
      const postResult = await postToHackMD(
        articleData.title,
        articleData.content
      );

      // 回傳 HackMD 的結果連結
      ctx.reply(postResult);
    } else {
      ctx.reply("無法抓取文章，請稍後再試。");
    }
  } else {
    ctx.reply("請提供有效的網址。");
  }
});

// 啟動 bot
bot.launch();
console.log("Telegram bot 已啟動");

// 檢查是否為有效的 URL
function isValidUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

async function isArticleUploaded(title) {
  try {
    const response = await axios.get(
      `https://api.hackmd.io/v1/teams/funblocks/notes`,
      {
        headers: {
          Authorization: `Bearer ${HACKMD_API_TOKEN}`,
        },
      }
    );

    // 獲取筆記數據
    const notes = response.data;

    // 找到所有重複標題的筆記連結
    const duplicateLinks = notes
      .filter((note) => note.title === title) // 過濾出標題匹配的筆記
      .map((note) => note.publishLink); // 獲取對應的 publishLink

    if (duplicateLinks.length > 0) {
      // 如果找到重複的標題，返回連結
      return duplicateLinks.join(", ");
      // 返回所有重複標題的連結
    } else {
      return 0;
    }
  } catch (error) {
    console.error("檢查上傳狀態時出錯:", error);
    return null;
  }
}
