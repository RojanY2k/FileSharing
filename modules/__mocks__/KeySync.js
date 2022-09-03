import CryptoJS from "crypto-js";
import fs from "fs";
import path from "path";

class KeySync {
  constructor() {}

  GenerateKeyPair = async (filename) => {
    var base64PrivateKey = CryptoJS.enc.Utf8.parse(
      `${filename}${process.env.PRIVATE_SECRET}`
    ).toString(CryptoJS.enc.Base64);
    console.log(`${filename}${process.env.PRIVATE_SECRET}`);
    console.log(base64PrivateKey);
    var base64PublicKey = CryptoJS.enc.Utf8.parse(
      `${filename}${process.env.PUBLIC_SECRET}`
    ).toString(CryptoJS.enc.Base64);

    return {
      privateKey: base64PrivateKey,
      publicKey: base64PublicKey,
    };
  };

  CreateKeyPair = async (req, res, next) => {
    const { privateKey, publicKey } = await this.GenerateKeyPair(
      req.file.filename
    );

    await fs.appendFile(
      process.env.MOCK_PRIVATE_KEY_PATH,
      `${privateKey} \n`,
      (err) => {
        return err;
      }
    );
    await fs.appendFile(
      process.env.MOCK_PUBLIC_KEY_PATH,
      `${publicKey} \n`,
      (err) => {
        return err;
      }
    );

    res.keys = {
      privateKey,
      publicKey,
    };

    next();
  };

  getTokens = async (location) => {
    return await new Promise(async (resolve, reject) => {
      await fs.readFile(location, "utf8", async function (err, data) {
        resolve(
          data
            .split("\n")
            .filter(Boolean)
            .map((row) => row.trim())
        );
      });
    });
  };

  VerifyToken = async (token, location) => {
    let tokenArr = await this.getTokens(location);
    return tokenArr.some((fileToken) => fileToken == token.trim());
  };

  TransformKeyToFilename = async (token, secret) => {
    var parsedTokenString = CryptoJS.enc.Base64.parse(token).toString(
      CryptoJS.enc.Utf8
    );
    return parsedTokenString.split(secret).shift();
  };
}

export { KeySync };
