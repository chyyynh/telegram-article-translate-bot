const youtubedl = require("youtube-dl-exec");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const { Telegraf } = require("telegraf"); // Telegram Bot API
require("dotenv").config(); // 載入環境變數

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const AZURE_SPEECH_API_URL = "https://eastasia.api.cognitive.microsoft.com/";
const AZURE_API_KEY = process.env.AZURE_SPEECH_API_KEY; // 在此填入你的 API key

// 1. 提取 YouTube 音訊
async function downloadAudio(youtubeURL) {
  const outputPath = "./audio.mp3";

  await youtubedl(youtubeURL, {
    extractAudio: true,
    audioFormat: "mp3",
    ffmpegLocation: "/path/to/ffmpeg", // 確保有正確安裝 ffmpeg
    output: outputPath,
  });

  console.log("Audio downloaded:", outputPath);
  return outputPath;
}

// audio to text
// https://learn.microsoft.com/zh-tw/azure/ai-services/speech-service/fast-transcription-create?tabs=locale-specified
// https://learn.microsoft.com/zh-tw/azure/ai-services/openai/whisper-quickstart?wt.mc_id=searchAPI_azureportal_inproduct_rmskilling&sessionId=8d29906dfebe426c9a3567df716f9d81&tabs=command-line%2Cpython-new%2Ctypescript-key%2Ctypescript-keyless&pivots=programming-language-javascript

bot.on("text", async (ctx) => {
  const url = ctx.message.text;

  const youtubeUrl = url;

  ctx.reply("正在處理您的請求，請稍等...");

  const outputFilePath = `./downloads/${Date.now()}.mp3`;

  try {
    // 步驟 1: 下載 YouTube 音訊
    await downloadAudio(youtubeUrl);
    ctx.reply("音訊下載完成！開始進行語音轉文字處理。");

    // 步驟 2: 語音轉文字
    // const transcription = await transcribeAudioGoogle(outputFilePath); // 或 transcribeAudioWhisper(outputFilePath)
    // bot.sendMessage(chatId, `轉文字結果：\n\n${transcription}`);
  } catch (error) {
    console.error("Error processing request:", error);
    ctx.reply("抱歉，處理過程中發生錯誤。");
  } finally {
    // 清理下載的檔案
    /*
      if (fs.existsSync(outputFilePath)) {
        fs.unlinkSync(outputFilePath);
      }
        */
  }
});

bot.launch();