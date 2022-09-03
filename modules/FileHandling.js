import CryptoJS from "crypto-js";
import path from "path";
import { KeySync } from "./KeySync.js";
import UDFilter from "./UDFilter.js";
const { VerifyToken, TransformKeyToFilename, getTokens } = new KeySync();

import fs from "fs";
import mime from "mime";
import ip from "ip";
import multer from "multer";

/**
 * Initialize:
 *  File Upload contact alteration of default name
 *  File default destination
 */
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, process.env.FOLDER);
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

  /**
   * File Upload
   * @param {*} req
   * @param {*} res
   * @param {*} next
   *
   * desciption:
   *  Upload file with max upload filtration per day based on same IP Address and logs.
   */
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

  /**
   * File Remove
   * @param {*} req
   * @param {*} res
   * @param {*} next
   *
   * desciption:
   *  Remove physical file using valid privateKey.
   *  Filter key if private and file exist
   */
  remove = async (req, res, next) => {
    try {
      const privateKey = req.params.privateKey;
      let isExist = await VerifyToken(privateKey, process.env.PRIVATE_KEY_PATH);
      if (isExist) {
        const filename = await TransformKeyToFilename(
          privateKey,
          process.env.PRIVATE_SECRET
        );
        fs.unlinkSync(`${process.env.FOLDER}/${filename}`);
        next();
      } else {
        res.status(404).json({ message: "File not found" });
      }
    } catch (error) {
      res.status(500).json({ error });
    }
  };

  /**
   * File Download
   * @param {*} req
   * @param {*} res
   * @param {*} next
   *
   * desciption:
   *  Download File with valid publicKey.
   */
  download = async (req, res, next) => {
    try {
      const publicKey = req.params.publicKey;
      let isExist = await VerifyToken(publicKey, process.env.PUBLIC_KEY_PATH);
      if (isExist) {
        if (await UDFilter.checkMax(false)) {
          const filename = await TransformKeyToFilename(
            publicKey,
            process.env.PUBLIC_SECRET
          );
          if (!fs.existsSync(`${process.env.FOLDER}${filename}`))
            return res.status(404).json({ message: "File not found" });
          var mimetype = mime.getType(filename);
          res.setHeader(
            "Content-disposition",
            "attachment; filename=" + `${process.env.FOLDER}${filename}`
          );
          res.setHeader("Content-type", mimetype);
          var filestream = await fs.createReadStream(
            `${process.env.FOLDER}${filename}`
          );
          filestream.pipe(res);

          // Write File Upload
          await UDFilter.writeFile(
            `DOWNLOAD ${new Date().toISOString().slice(0, 10)} ${filename}`
          );
        } else
          res.status(401).json({ message: "max download for the day reached" });
      } else {
        res.status(404).json({ message: "File not found" });
      }
    } catch (error) {
      console.log("ERR");
      res.status(500).json({ error });
    }
  };

  /**
   * Storage Cleanup
   * @param {*} req
   * @param {*} res
   * @param {*} next
   *
   * desciption:
   *  Remove unused files based on date set.
   */
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
                  `${row.split(" ")[2].trim()}${process.env.PRIVATE_SECRET}`
                )
                  .toString(CryptoJS.enc.Base64)
                  .trim();
              })
              .filter(Boolean);

            //   Return Public Prevailing Keys
            var base64PublicKeys = rows
              .map((row) => {
                return CryptoJS.enc.Utf8.parse(
                  `${row.split(" ")[2].trim()}${process.env.PUBLIC_SECRET}`
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
          process.env.PRIVATE_KEY_PATH,
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
          process.env.PUBLIC_KEY_PATH,
          "utf8",
          async function (err, data) {
            resolve(
              data.split("\n").filter((row) => keys.includes(row.trim()))
            );
          }
        );
      });

      await fs.writeFileSync(
        process.env.PRIVATE_KEY_PATH,
        updatedPrivateKeys.join("\n")
      );
      await fs.writeFileSync(
        process.env.PUBLIC_KEY_PATH,
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
