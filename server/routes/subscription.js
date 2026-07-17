import express from "express";
import { createOrder, verifyPayment, getUserPlan } from "../controllers/subscription.js";

const routes = express.Router();

routes.post("/create-order", createOrder);
routes.post("/verify", verifyPayment);
routes.get("/plan/:userId", getUserPlan);

export default routes;
