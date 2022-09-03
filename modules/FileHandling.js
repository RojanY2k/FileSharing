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
   * File Uploader with Multer
   * @param {*} req
   * @param {*} res
   * @param {*} next
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
    } else res.status(500).json({ message: "max upload for the day reached" });
  };

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

  download = async (req, res, next) => {
    try {
      if (await UDFilter.checkMax(false)) {
        const publicKey = req.params.publicKey;
        let isExist = await VerifyToken(publicKey, process.env.PUBLIC_KEY_PATH);
        if (isExist) {
          const filename = await TransformKeyToFilename(
            publicKey,
            process.env.PUBLIC_SECRET
          );
          var mimetype = mime.getType(filename);
          res.setHeader(
            "Content-disposition",
            "attachment; filename=" + `${process.env.FOLDER}${filename}`
          );
          res.setHeader("Content-type", mimetype);
          var filestream = fs.createReadStream(
            `${process.env.FOLDER}${filename}`
          );
          filestream.pipe(res);

          // Write File Upload
          await UDFilter.writeFile(
            `DOWNLOAD ${new Date().toISOString().slice(0, 10)} ${filename}`
          );
        } else {
          res.status(404).json({ message: "File not found" });
        }
      } else
        res.status(500).json({ message: "max download for the day reached" });
    } catch (error) {
      res.status(500).json({ error });
    }
  };
}

export { FileHandling };
