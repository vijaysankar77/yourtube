import express from "express";
import { sendOTP, verifyOTP } from "../controllers/otp.js";

const routes = express.Router();

routes.post("/send", sendOTP);
routes.post("/verify", verifyOTP);

export default routes;
