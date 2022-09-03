import request from "supertest";
import app from "./server.js";
import path from "path";
import fs from "fs";

function FormDataMock() {
  this.append = jest.fn();
}
global.FormData = FormDataMock;
jest.mock("./modules/FileHandling");
jest.mock("./modules/KeySync");
jest.mock("./modules/UDFilter");

let server, agent;
beforeEach((done) => {
  server = app.listen(4000, (err) => {
    if (err) return done(err);

    agent = request.agent(server); // since the application is already listening, it should use the allocated port
    done();
  });
});

afterEach((done) => {
  server.close(done);
});

const emptyMockFiles = async () => {
  await new Promise(async (resolve, reject) => {
    await fs.rmdir(process.env.MOCK_FOLDER, { recursive: true }, (err) => {
      if (err) {
        reject(err);
      }
      if (!fs.existsSync(process.env.MOCK_FOLDER)) {
        fs.mkdirSync(process.env.MOCK_FOLDER);
      }
      fs.truncate(process.env.MOCK_PRIVATE_KEY_PATH, 0, function () {
        console.log(process.env.MOCK_PRIVATE_KEY_PATH + "File Content Deleted");
      });
      fs.truncate(process.env.MOCK_PUBLIC_KEY_PATH, 0, function () {
        console.log(process.env.MOCK_PUBLIC_KEY_PATH + "File Content Deleted");
      });
      fs.truncate(process.env.MOCK_UDIPS, 0, function () {
        console.log(process.env.MOCK_UDIPS + "File Content Deleted");
      });
      resolve(true);
    });
  });
};

describe("POST /files", () => {
  describe("given file upload", () => {
    beforeAll(async () => await emptyMockFiles());
    test("Should status code 201 and contain publicKey and privateKey", async () => {
      let filesToUpload = [
        "public/287298782_1692351554431919_1015822615541770175_n.jpg",
        "public/299189429_2834054116890777_6712784163955856841_n.jpg",
        "public/logs.txt",
      ];

      let imagePath = "";
      for (let file of filesToUpload) {
        imagePath = path.join(__dirname, file);
        await agent
          .post("/files")
          .set("content-type", "application/octet-stream")
          .attach("avatar", imagePath)
          .expect(201)
          .expect((response) => {
            let keys = Object.keys(response.body);
            expect(keys).toContain("privateKey");
            expect(keys).toContain("publicKey");
          });
      }
    });

    test("Should satus code of 500, max limit is reached for the day", async () => {
      const image = path.join(
        __dirname,
        "public/299189429_2834054116890777_6712784163955856841_n.jpg"
      );

      await agent
        .post("/files")
        .set("content-type", "application/octet-stream")
        .attach("avatar", image)
        .expect(500);
    });
  });
});

describe("GET /files", () => {
  test("Should status code of 200, file is sucessfuly downloaded, mime type should be image", async () => {
    let key = await new Promise(async (resolve, reject) => {
      await fs.readFile(
        `${process.env.MOCK_PUBLIC_KEY_PATH}`,
        "utf8",
        async function (err, data) {
          let publicKey = data.split("\n").filter(Boolean)[0];

          resolve(publicKey);
        }
      );
    });
    await agent
      .get(`/files/${key}`)
      .expect(200)
      .expect((response) => {
        let keys = Object.keys(response.body);
        expect(keys).toContain("mimetype");
        expect(response.body.mimetype).toMatch("image/jpeg");
      });
  });
  test("Should status code of 404, File not found if wrong key", async () => {
    await agent.get(`/files/loremipsum`).expect(404);
  });
  test("Should status code of 404, Private Key must not be able to download file", async () => {
    let key = await new Promise(async (resolve, reject) => {
      await fs.readFile(
        `${process.env.MOCK_PRIVATE_KEY_PATH}`,
        "utf8",
        async function (err, data) {
          let publicKey = data.split("\n").filter(Boolean)[0];

          resolve(publicKey);
        }
      );
    });
    await agent.get(`/files/${key}`).expect(404);
  });
});

describe("DELETE /files", () => {
  let privateKey;
  test("Should status code of 200, physical file should be removed from source", async () => {
    let key = await new Promise(async (resolve, reject) => {
      await fs.readFile(
        `${process.env.MOCK_PRIVATE_KEY_PATH}`,
        "utf8",
        async function (err, data) {
          let privateKey = data.split("\n").filter(Boolean).pop();

          resolve(privateKey);
        }
      );
    });
    await agent.delete(`/files/${key}`).expect(200);
  });
  test("Should status code of 400, file should no longer be found after delete", async () => {
    await agent.delete(`/files/${privateKey}`).expect(404);
  });
});
