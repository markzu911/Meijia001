import express, { Request, Response, NextFunction } from "express";
import axios from "axios";

const app = express();
app.use(express.json({ limit: '10mb' }));

app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Content-Security-Policy", "frame-ancestors *");
  
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

const proxyRequest = async (req: Request, res: Response, targetPath: string) => {
  const targetUrl = `http://aibigtree.com${targetPath}`;
  try {
    const response = await axios({
      method: req.method,
      url: targetUrl,
      data: req.body,
      headers: { 'Content-Type': 'application/json' }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    res.status(500).json({ error: "代理转发失败" });
  }
};

app.post("/api/tool/launch", (req: Request, res: Response) => proxyRequest(req, res, "/api/tool/launch"));
app.post("/api/tool/verify", (req: Request, res: Response) => proxyRequest(req, res, "/api/tool/verify"));
app.post("/api/tool/consume", (req: Request, res: Response) => proxyRequest(req, res, "/api/tool/consume"));

// 安全生成接口 (最佳实践)
app.post("/api/generate", async (req: Request, res: Response) => {
  const { userId, toolId, imageBase64, mimeType, stylePrompt } = req.body;
  
  // 1. 验证 (后端调用 http://aibigtree.com/api/tool/verify)
  // 2. 生成 (后端调用 AI 服务)
  // 3. 扣费 (后端调用 http://aibigtree.com/api/tool/consume)
  // 4. 返回结果
  res.status(501).json({ error: "Not Implemented Yet. Please use client-side generation for now." });
});

export default app;
