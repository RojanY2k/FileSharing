import CryptoJS from "crypto-js";
import path from "path";
import { KeySync } from "./KeySync.js";
import UDFilter from "./UDFilter.js";
const { VerifyToken, TransformKeyToFilename, getTokens } = new KeySync();

import fs from "fs";
import mime from "mime";
import ip from "ip";
import multer from "multer";
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.MOCK_FOLDER);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix =
      new Date().toISOString().slice(0, 10) +
      "--" +
      Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    cb(null, `${CryptoJS.MD5(ip.address())}--${uniqueSuffix}${ext}`);
  },
});
const upload = multer({ storage });

class FileHandling {
  constructor() {}

  save = async (req, res, next) => {
    if (await UDFilter.checkMax(true)) {
      const status = await new Promise(async (resolve, reject) => {
        await upload.single("avatar")(req, res, async function (err) {
          if (err instanceof multer.MulterError || err) {
            reject({
              uploaded: false,
              err: err,
            });
          } else {
            resolve({
              uploaded: true,
              fieldname: req.file.filename,
            });
          }
        });
      }).catch((err) => {
        return err;
      });

      // Write File Upload
      if (status.uploaded) {
        await UDFilter.writeFile(
          `UPLOAD ${new Date().toISOString().slice(0, 10)} ${req.file.filename}`
        );
        next();
      } else res.status(500).json(status);
    } else res.status(401).json({ message: "max upload for the day reached" });
  };

  remove = async (req, res, next) => {
    try {
      const privateKey = req.params.privateKey;
      let isExist = await VerifyToken(
        privateKey,
        process.env.MOCK_PRIVATE_KEY_PATH
      );
      if (isExist) {
        const filename = await TransformKeyToFilename(
          privateKey,
          process.env.PRIVATE_SECRET
        );
        fs.unlinkSync(`${process.env.MOCK_FOLDER}/${filename}`);
        next();
      } else {
        res.status(404).json({ message: "File not found" });
      }
    } catch (error) {
      res.status(500).json({ error });
    }
  };

  download = async (req, res, next) => {
    try {
      const publicKey = req.params.publicKey;
      let isExist = await VerifyToken(
        publicKey,
        process.env.MOCK_PUBLIC_KEY_PATH
      );

      if (isExist) {
        if (await UDFilter.checkMax(false)) {
          const filename = await TransformKeyToFilename(
            publicKey,
            process.env.PUBLIC_SECRET
          );
          if (!fs.existsSync(`${process.env.MOCK_FOLDER}${filename}`))
            return res.status(404).json({ message: "File not found" });
          var mimetype = mime.getType(filename);
          // Write File Upload
          await UDFilter.writeFile(
            `DOWNLOAD ${new Date().toISOString().slice(0, 10)} ${filename}`
          );
          res.status(200).send({ mimetype: mimetype });
        } else
          res.status(401).json({ message: "max download for the day reached" });
      } else {
        res.status(404).json({ message: "File not found" });
      }
    } catch (error) {
      res.status(500).json({ error });
    }
  };

  removeUnusedFiles = async () => {
    try {
      let currentDate = new Date();
      let minDate = new Date(
        currentDate.setDate(
          currentDate.getDate() - process.env.INACTIVE_FILES_IN_DAYS
        )
      );

      let dateThreshold = minDate.toISOString().slice(0, 10);
      const keys = await new Promise(async (resolve, reject) => {
        await fs.readFile(
          process.env.UDIPS,
          "utf8",
          async function (err, data) {
            // Get Data to retain
            let rows = data
              .split("\n")
              .filter(Boolean)
              .filter((row) => {
                // Get Valid Files
                let dateOfFile = row.split(" ")[1].trim();
                return new Date(dateThreshold) <= new Date(dateOfFile);
              });

            //   Overwrite UDFiles.txt
            await fs.writeFileSync(process.env.UDIPS, rows.join("\n"));

            //   Return Private Prevailing Keys
            var base64PrivateKeys = rows
              .map((row) => {
                return CryptoJS.enc.Utf8.parse(
                  `${row.split(" ")[2].trim()}${
                    process.env.MOCK_PRIVATE_SECRET
                  }`
                )
                  .toString(CryptoJS.enc.Base64)
                  .trim();
              })
              .filter(Boolean);

            //   Return Public Prevailing Keys
            var base64PublicKeys = rows
              .map((row) => {
                return CryptoJS.enc.Utf8.parse(
                  `${row.split(" ")[2].trim()}${process.env.MOCK_PUBLIC_SECRET}`
                )
                  .toString(CryptoJS.enc.Base64)
                  .trim();
              })
              .filter(Boolean);

            resolve([...base64PublicKeys, ...base64PrivateKeys]);
          }
        );
      });

      let updatedPrivateKeys = await new Promise(async (resolve, reject) => {
        await fs.readFile(
          process.env.MOCK_PRIVATE_KEY_PATH,
          "utf8",
          async function (err, data) {
            resolve(
              data.split("\n").filter((row) => keys.includes(row.trim()))
            );
          }
        );
      });

      let updatedPublicKeys = await new Promise(async (resolve, reject) => {
        await fs.readFile(
          process.env.MOCK_PUBLIC_KEY_PATH,
          "utf8",
          async function (err, data) {
            resolve(
              data.split("\n").filter((row) => keys.includes(row.trim()))
            );
          }
        );
      });

      await fs.writeFileSync(
        process.env.MOCK_PRIVATE_KEY_PATH,
        updatedPrivateKeys.join("\n")
      );
      await fs.writeFileSync(
        process.env.MOCK_PUBLIC_KEY_PATH,
        updatedPublicKeys.join("\n")
      );

      return {
        status: 200,
        message: "Cleaned",
      };
    } catch (error) {
      return {
        status: 500,
        error: error,
      };
    }
  };
}

export { FileHandling };
