import React, { useState, useRef, useEffect } from 'react';
import { Upload, Image as ImageIcon, Sparkles, Loader2, Download, RefreshCw, Wand2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const STYLES = [
  { 
    id: 'red', 
    name: '经典正红 (Classic Red)', 
    prompt: 'Classic, vibrant, high-saturation pure red nail polish. High-end tone, not orange, not purple, not rose red. Mature, confident, elegant. Five nails uniformly coated with high-gloss top coat, smooth and flat, bright reflection, like a high-quality salon finish. No patterns, no rhinestones, no decorations.' 
  },
  { 
    id: 'wine', 
    name: '酒红魅影 (Wine Red)', 
    prompt: 'Deep, rich wine red or burgundy with a slight brown tone and vintage feel. Calm, mysterious, mature. High-quality glossy gel effect, uniform and full color, slightly translucent in dark tones, not black or muddy. No complex patterns or decorations.' 
  },
  { 
    id: 'purple', 
    name: '淡雅紫色 (Soft Purple)', 
    prompt: 'Soft, low-saturation light purple or lavender with a slight grey tone. Gentle, romantic, fresh. Fine glossy texture, uniform and soft color, light and translucent feel. No complex decorations, clean and soft pure color.' 
  },
  { 
    id: 'pale', 
    name: '淡雅裸色 (Pale Nude)', 
    prompt: 'Natural, soft pale nude, milk coffee nude pink, or light warm beige. Low saturation, minimalist, gentle, professional. Natural glossy texture, clean and delicate. No heavy pink, no obvious pearl, no decorations.' 
  },
  { 
    id: 'french', 
    name: '法式美甲 (French)', 
    prompt: 'Classic French manicure. Base is translucent natural nude pink or milky white. Tips have neat, exquisite white French arcs. Fine, smooth, clean white lines with elegant curvature and coordinated proportions. No complex patterns or decorations.' 
  },
  { 
    id: 'glitter', 
    name: '闪片美甲 (Glitter)', 
    prompt: 'Exquisite fine glitter nail art. High-density fine glitter and tiny sequins uniformly overlaid on a clear base. High-end, delicate, layered glitter in silver, champagne, or pink gold. Shimmering, dreamy, eye-catching with realistic light reflection. No large rhinestones.' 
  },
  { 
    id: 'matte', 
    name: '哑光美甲 (Matte)', 
    prompt: 'High-quality matte texture. Soft, delicate, non-reflective frosted effect, like velvet. Uniform color, low-key, modern, minimalist. No complex decorations, focusing on the matte texture.' 
  },
  { 
    id: 'floral', 
    name: '碎花美甲 (Floral)', 
    prompt: 'Gentle, exquisite floral nail art. Base is soft nude pink, milky white, or translucent pink. Delicate small flower patterns on some nails in French small floral or Japanese gentle style. Fresh, light, with white space. Glossy texture, natural brushstrokes.' 
  },
  { 
    id: 'minimalist', 
    name: '极简线条 (Minimalist)', 
    prompt: 'Minimalist line design. Low-saturation base (nude pink, milky white, grey beige). Simple, restrained black, white, or metallic lines or geometric elements on some nails. Precise, clean, modern, artistic. "Less is more" aesthetic.' 
  },
  { 
    id: 'ombre', 
    name: '渐变美甲 (Ombre)', 
    prompt: 'High-quality ombre/gradient. Smooth color transition on each nail (nude pink to milky white, bean paste to transparent, etc.). Very fine and natural transition without obvious layers or harsh boundaries. Gentle, light, dreamy. Glossy texture.' 
  },
];

export default function App() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedMimeType, setSelectedMimeType] = useState<string | null>(null);
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [resultImage, setResultImage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [saasInfo, setSaasInfo] = useState<{userId: string, toolId: string} | null>(null);
  const [userPoints, setUserPoints] = useState<{ current: number; required: number } | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'SAAS_INIT') {
        let { userId, toolId } = event.data;
        
        // Filter out invalid placeholder strings
        if (userId === 'null' || userId === 'undefined') userId = null;
        if (toolId === 'null' || toolId === 'undefined') toolId = null;

        if (userId && toolId) {
          setSaasInfo({ userId, toolId });
          // 1. 启动阶段 (/api/tool/launch)
          console.log("Step 1: Launching tool with SaaS info...");
          fetch('/api/tool/launch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ userId, toolId })
          })
          .then(res => res.json())
          .then(data => {
            if (data.success && data.data) {
              setUserPoints({ 
                current: data.data.user.integral, 
                required: data.data.tool.integral 
              });
              console.log("Launch successful, points received:", data.data);
            }
          })
          .catch(err => console.error("Launch API failed", err));
        }
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSelectedImage(base64String);
        setSelectedMimeType(file.type);
        setResultImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64String = reader.result as string;
        setSelectedImage(base64String);
        setSelectedMimeType(file.type);
        setResultImage(null);
        setError(null);
      };
      reader.readAsDataURL(file);
    }
  };

  const generateNailArt = async () => {
    if (!selectedImage || !selectedMimeType) return;

    setError(null);
    setIsVerifying(true);

    try {
      // 2. 校验阶段 (/api/tool/verify)
      if (saasInfo) {
        console.log("Step 2: Starting verification...");
        const verifyRes = await fetch('/api/tool/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saasInfo)
        });
        const verifyData = await verifyRes.json();
        
        // Relaxed validation per SPEC
        if (!verifyData.success && !verifyData.valid) {
          setIsVerifying(false);
          setError(verifyData.message || "积分不足，无法生成");
          return;
        }
        
        console.log("Step 2: Verification passed. Finalizing checks before generation.");
        // Update local points if returned
        if (verifyData.data) {
          setUserPoints({
            current: verifyData.data.currentIntegral,
            required: verifyData.data.requiredIntegral
          });
        }
      }

      // If we reach here, we are verified. Now start the actual generation.
      console.log("System verified. Proceeding to AI generation...");
      setIsVerifying(false);
      setIsGenerating(true);
      setResultImage(null);

      const base64Data = selectedImage.split(',')[1];
      
      console.log("Step 2b: Invoking AI model...");
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              inlineData: {
                data: base64Data,
                mimeType: selectedMimeType,
              },
            },
            {
              text: `Add beautiful nail art to the hand in this image. Style: ${selectedStyle.prompt}. Make it look highly realistic, perfectly fitting the natural shape of the nails. Do not change the background or the hand itself, only modify the nails.`,
            },
          ],
        },
      });

      let foundImage = false;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const imageUrl = `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
          setResultImage(imageUrl);
          foundImage = true;
          break;
        }
      }

      if (!foundImage) {
        throw new Error("AI未能生成图片，请重试。");
      }

      // 3. 扣费阶段 (/api/tool/consume)
      if (saasInfo) {
        console.log("Step 3: AI success, consuming points...");
        const consumeRes = await fetch('/api/tool/consume', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(saasInfo)
        });
        const consumeData = await consumeRes.json();
        console.log("Consumption result:", consumeData);
        // Refresh points after consumption
        if (consumeData.success && consumeData.data) {
          setUserPoints(prev => prev ? { ...prev, current: consumeData.data.currentIntegral } : null);
        }
      }
    } catch (err: any) {
      console.error("Task failed:", err);
      setError(err.message || "生成美甲时发生错误。");
    } finally {
      setIsVerifying(false);
      setIsGenerating(false);
    }
  };

  const handleDownload = () => {
    if (resultImage) {
      const a = document.createElement('a');
      a.href = resultImage;
      a.download = `nail-art-${selectedStyle.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }
  };

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 font-sans selection:bg-red-100">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center text-white">
              <Sparkles size={18} />
            </div>
            <h1 className="text-xl font-semibold tracking-tight">自动美甲生成器</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Column: Controls */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-sm font-medium">1</span>
                上传手部照片
              </h2>
              
              <div 
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer
                  ${selectedImage ? 'border-red-200 bg-red-50/50' : 'border-stone-300 hover:border-red-300 hover:bg-stone-50'}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleDrop}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept="image/*"
                  onChange={handleImageUpload}
                />
                
                {selectedImage ? (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-red-50 text-red-500 rounded-full flex items-center justify-center">
                      <ImageIcon size={24} />
                    </div>
                    <p className="text-sm font-medium text-red-600">已选择图片</p>
                    <p className="text-xs text-stone-500">点击或拖拽重新上传</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-16 h-16 mx-auto bg-stone-100 text-stone-500 rounded-full flex items-center justify-center">
                      <Upload size={24} />
                    </div>
                    <p className="text-sm font-medium text-stone-700">点击或拖拽上传图片</p>
                    <p className="text-xs text-stone-500">支持 JPG, PNG 格式</p>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200">
              <h2 className="text-lg font-medium mb-4 flex items-center gap-2">
                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-sm font-medium">2</span>
                选择美甲风格
              </h2>
              
              <div className="grid grid-cols-2 gap-3">
                {STYLES.map((style) => (
                  <button
                    key={style.id}
                    onClick={() => setSelectedStyle(style)}
                    className={`px-3 py-3 rounded-xl text-sm font-medium transition-all text-left
                      ${selectedStyle.id === style.id 
                        ? 'bg-red-500 text-white shadow-md shadow-red-500/20 ring-2 ring-red-300 ring-offset-2' 
                        : 'bg-stone-50 text-stone-700 hover:bg-stone-100 border border-stone-200'}`}
                  >
                    {style.name}
                  </button>
                ))}
              </div>
            </div>

            <button
              onClick={generateNailArt}
              disabled={!selectedImage || isGenerating || isVerifying}
              className={`w-full py-4 rounded-xl font-medium text-white flex items-center justify-center gap-2 transition-all
                ${!selectedImage 
                  ? 'bg-stone-300 cursor-not-allowed' 
                  : (isGenerating || isVerifying) 
                    ? 'bg-red-300 cursor-wait' 
                    : 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/20 active:scale-[0.98]'}`}
            >
              {isVerifying ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  正在校验积分...
                </>
              ) : isGenerating ? (
                <>
                  <Loader2 size={20} className="animate-spin" />
                  正在生成美甲...
                </>
              ) : (
                <>
                  <Wand2 size={20} />
                  一键生成美甲
                </>
              )}
            </button>

            {userPoints && saasInfo && (
              <div className="flex items-center justify-between px-2 pt-2 text-[10px] text-stone-500 font-medium">
                <span className="flex items-center gap-1 opacity-70">
                  所需积分: <span className="text-red-500/80">{userPoints.required}</span>
                </span>
                <span className="flex items-center gap-1 bg-stone-100 px-2 py-0.5 rounded-full">
                  当前余额: <span className="text-stone-700">{userPoints.current}</span>
                </span>
              </div>
            )}

            {error && (
              <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm border border-red-100">
                {error}
              </div>
            )}
          </div>

          {/* Right Column: Preview */}
          <div className="lg:col-span-8">
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-stone-200 min-h-[600px] flex flex-col">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-medium flex items-center gap-2">
                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-sm font-medium">3</span>
                  效果预览
                </h2>
                
                {resultImage && (
                  <div className="flex gap-2">
                    <button 
                      onClick={() => generateNailArt()}
                      disabled={isGenerating}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-stone-700 bg-stone-100 hover:bg-stone-200 transition-colors flex items-center gap-2"
                    >
                      <RefreshCw size={16} className={isGenerating ? "animate-spin" : ""} />
                      重新生成
                    </button>
                    <button 
                      onClick={handleDownload}
                      className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-stone-900 hover:bg-black transition-colors flex items-center gap-2"
                    >
                      <Download size={16} />
                      保存图片
                    </button>
                  </div>
                )}
              </div>

              <div className="flex-1 bg-stone-100 rounded-xl overflow-hidden relative flex items-center justify-center border border-stone-200">
                {!selectedImage ? (
                  <div className="text-center text-stone-400 p-8">
                    <ImageIcon size={48} className="mx-auto mb-4 opacity-50" />
                    <p>请先在左侧上传手部照片</p>
                  </div>
                ) : (
                  <div className="absolute inset-0 flex">
                    <AnimatePresence mode="wait">
                      {resultImage ? (
                        <motion.div 
                          key="result"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="w-full h-full relative"
                        >
                          <img 
                            src={resultImage} 
                            alt="Generated Nail Art" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium">
                            生成结果 ({selectedStyle.name})
                          </div>
                        </motion.div>
                      ) : (
                        <motion.div 
                          key="original"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="w-full h-full relative"
                        >
                          <img 
                            src={selectedImage} 
                            alt="Original Hand" 
                            className="w-full h-full object-contain"
                            referrerPolicy="no-referrer"
                          />
                          <div className="absolute top-4 left-4 bg-black/60 backdrop-blur-md text-white px-3 py-1.5 rounded-full text-xs font-medium">
                            原图
                          </div>
                          
                          {isGenerating && (
                            <div className="absolute inset-0 bg-white/50 backdrop-blur-sm flex items-center justify-center">
                              <div className="bg-white p-6 rounded-2xl shadow-xl flex flex-col items-center gap-4">
                                <Loader2 size={32} className="animate-spin text-red-500" />
                                <p className="text-sm font-medium text-stone-700">AI 正在为您绘制美甲...</p>
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
