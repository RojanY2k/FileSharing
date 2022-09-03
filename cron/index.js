import cron from "node-cron";
import CryptoJS from "crypto-js";
import fs from "fs";
import { FileHandling } from "./../modules/FileHandling.js";
const { removeUnusedFiles } = new FileHandling();

// Run Cron everu hour for internal checking of inactive files based on UPLOAD AND DOWNLOAD
export default () => {
  return cron.schedule("* * 1 * *", () => {
    console.log("running a task every hour");
    removeUnusedFiles();
  });
};
