import type { User } from "../server/db/schema.js";
import type { Request, Response } from "express";

export type TrpcContext = {
  user: User | null;
  req: Request;
  res: Response;
};
