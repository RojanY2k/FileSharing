import CryptoJS from "crypto-js";
import fs from "fs";
import ip from "ip";

export default {
  checkMax: async (isUpload) => {
    let type = isUpload ? "UPLOAD" : "DOWNLOAD";
    let IPsAndDateCount = await new Promise(async (resolve, reject) => {
      await fs.readFile(
        process.env.MOCK_UDIPS,
        "utf8",
        async function (err, data) {
          let IPEncrypt = CryptoJS.MD5(ip.address());
          let currentDate = new Date().toISOString().slice(0, 10);
          let rows = data
            .split("\n")
            .filter(Boolean)
            .map((row) => row.trim());
          resolve(
            rows.filter(
              (row) =>
                row.includes(IPEncrypt) &&
                row.includes(currentDate) &&
                row.includes(type)
            ).length
          );
        }
      );
    });

    if (isUpload) {
      return IPsAndDateCount < process.env.IP_MAX_UPLOAD ? true : false;
    }
    return IPsAndDateCount < process.env.IP_MAX_DOWNLOAD ? true : false;
  },
  writeFile: async (content) => {
    return await fs.appendFile(
      process.env.MOCK_UDIPS,
      `${content} \n`,
      (err) => {
        return err;
      }
    );
  },
};
