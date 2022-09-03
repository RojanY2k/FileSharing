import express from "express";
import dotenv from "dotenv";
dotenv.config();
import cors from "cors";
import fs from "fs";
import mime from "mime";
import { FileHandling } from "./modules/FileHandling.js";
import { KeySync } from "./modules/KeySync.js";

const app = express();
app.use(cors());

// Static Files
app.use(express.static("views"));

// Set Views
app.set("views", "./views");
app.set("view engine", "ejs");

const { save, remove, download } = new FileHandling();
const { CreateKeyPair } = new KeySync();

app.post("/files", save, CreateKeyPair, async (req, res) => {
  res.status(201).send(res.keys);
});

app.delete("/files/:privateKey", remove, async (req, res) => {
  res.status(200).send({ message: "removed" });
});

app.get("/files/:publicKey", download, async (req, res) => {});
app.get("", (req, res) => {
  res.render("index.ejs");
});

export default app;
