
import { GoogleGenAI, GenerateContentResponse, Type } from "@google/genai";
import { StrategyRequest, ContentPlanItem, PostAnalytics, PageProfile, PerformanceSummaryData } from "../types";

const fileToGenerativePart = async (file: File) => {
  const base64EncodedDataPromise = new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(',')[1]);
    reader.readAsDataURL(file);
  });
  return {
    inlineData: { data: await base64EncodedDataPromise, mimeType: file.type },
  };
}

const createPageContext = (pageProfile?: PageProfile): string => {
  if (!pageProfile || Object.values(pageProfile).every(val => !val)) {
    return '';
  }
  return `
    ---
    سياق الصفحة/العمل (استخدم هذه المعلومات في ردك):
    - وصف العمل: ${pageProfile.description || 'غير محدد'}
    - المنتجات/الخدمات: ${pageProfile.services || 'غير محدد'}
    - العنوان: ${pageProfile.address || 'غير محدد'}
    - البلد: ${pageProfile.country || 'غير محدد'}
    - معلومات الاتصال: ${pageProfile.contactInfo || 'غير محدد'}
    - الموقع الإلكتروني: ${pageProfile.website || 'غير محدد'}
    - العروض الحالية: ${pageProfile.currentOffers || 'غير محدد'}
    ---
  `;
};

export const enhanceProfileFromFacebookData = async (
  ai: GoogleGenAI,
  facebookData: { about?: string; category?: string; contact?: string; website?: string; address?: string, country?: string }
): Promise<PageProfile> => {
  const prompt = `
    أنت خبير في الهوية التجارية والتسويق الرقمي. مهمتك هي أخذ البيانات الأولية لصفحة فيسبوك وتحويلها إلى ملف تعريف احترافي وجذاب.
    
    البيانات الأولية من فيسبوك:
    - الوصف (About): "${facebookData.about || 'غير متوفر'}"
    - الفئة (Category): "${facebookData.category || 'غير متوفر'}"
    - معلومات الاتصال: "${facebookData.contact || 'غير متوفر'}"
    - الموقع الإلكتروني: "${facebookData.website || 'غير متوفر'}"
    - العنوان: "${facebookData.address || 'غير متوفر'}"
    - البلد: "${facebookData.country || 'غير متوفر'}"

    المطلوب:
    قم بإنشاء كائن JSON فقط، بدون أي نص إضافي أو علامات markdown، يحتوي على المفاتيح التالية بالقيم المحسنة:
    1. "description": (string) أعد كتابة الوصف ليكون أكثر جاذبية وتسويقية. اجعله موجزًا ويركز على القيمة المقدمة للعميل.
    2. "services": (string) من خلال الوصف والفئة، استنتج قائمة بالمنتجات أو الخدمات الرئيسية التي يقدمها العمل. افصل بينها بفاصلة.
    3. "contactInfo": (string) قم بتنظيم معلومات الاتصال التي تم استردادها في سلسلة نصية واضحة.
    4. "website": (string) استخدم رابط الموقع كما هو.
    5. "address": (string) استخدم العنوان كما هو.
    6. "country": (string) استخدم البلد كما هو.
    7. "currentOffers": (string) اترك هذا الحقل فارغًا ("").

    إذا كانت إحدى المعلومات غير متوفرة في البيانات الأولية، فاترك الحقل المقابل لها فارغًا في الـ JSON. لا تخمن أي معلومات.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
         responseMimeType: "application/json",
         responseSchema: {
            type: Type.OBJECT,
            properties: {
                description: { type: Type.STRING },
                services: { type: Type.STRING },
                contactInfo: { type: Type.STRING },
                website: { type: Type.STRING },
                address: { type: Type.STRING },
                country: { type: Type.STRING },
                currentOffers: { type: Type.STRING }
            }
         }
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("لم يتمكن الذكاء الاصطناعي من تحسين الملف الشخصي (استجابة فارغة).");
    }
    
    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const enhancedProfile = JSON.parse(jsonStr);
    
    if (enhancedProfile && typeof enhancedProfile.description === 'string') {
        return enhancedProfile;
    }
    
    throw new Error("فشل الذكاء الاصطناعي في إنشاء ملف شخصي بالتنسيق المطلوب.");
    
  } catch (error) {
    console.error("Error enhancing profile from Facebook data:", error);
    throw new Error("حدث خطأ أثناء تحسين بيانات الصفحة بالذكاء الاصطناعي.");
  }
};

export const initializeGoogleGenAI = (apiKey: string): GoogleGenAI | null => {
  if (!apiKey) {
    console.warn("Gemini API key is not provided. Client not initialized.");
    return null;
  }
  try {
    return new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    return null;
  }
};

export const generatePostSuggestion = async (ai: GoogleGenAI, topic: string, pageProfile?: PageProfile): Promise<string> => {
  try {
    const pageContext = createPageContext(pageProfile);
    const prompt = `
    ${pageContext}
    أنت خبير في التسويق عبر وسائل التواصل الاجتماعي.
    مهمتك هي كتابة منشور جذاب لصفحة فيسبوك حول الموضوع التالي: "${topic}".
    يجب أن يكون المنشور:
    - باللغة العربية.
    - متوافقًا مع سياق الصفحة والعمل الموضح أعلاه.
    - ودود ومحفز للنقاش.
    - يحتوي على سؤال أو دعوة للتفاعل (call to action).
    - يستخدم بعض الإيموجي المناسبة بشكل طبيعي.
    - لا تضع عنوانًا للمنشور، ابدأ مباشرة بالمحتوى.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text ?? '';
  } catch (error) {
    console.error("Error generating post suggestion:", error);
    throw new Error("حدث خطأ أثناء إنشاء الاقتراح. يرجى المحاولة مرة أخرى.");
  }
};

export const generateImageFromPrompt = async (ai: GoogleGenAI, prompt: string): Promise<string> => {
  if (!prompt.trim()) {
    throw new Error("يرجى إدخال وصف لإنشاء الصورة.");
  }
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-002',
      prompt: `صورة فوتوغرافية سينمائية عالية الجودة لـ: ${prompt}`,
      config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
    });

    if (response.generatedImages && response.generatedImages.length > 0 && response.generatedImages[0].image && response.generatedImages[0].image.imageBytes) {
      return response.generatedImages[0].image.imageBytes;
    } else {
      console.error("Image generation failed, API did not return an image.", response);
      throw new Error("فشل إنشاء الصورة. قد يكون السبب هو حظر المحتوى لأسباب تتعلق بالسلامة أو مشكلة أخرى في الاستجابة.");
    }
  } catch (error) {
    console.error("Error generating image:", error);
    let detailedMessage = "حاول مرة أخرى.";
    if (error instanceof Error) {
        detailedMessage = error.message;
    }
    throw new Error(`حدث خطأ أثناء إنشاء الصورة. السبب: ${detailedMessage}. يرجى التحقق من تفعيل الفوترة وواجهة Vertex AI API في مشروع Google Cloud.`);
  }
};

export const getBestPostingTime = async (ai: GoogleGenAI, postText: string): Promise<Date> => {
  if (!postText.trim()) {
    throw new Error("يرجى كتابة منشور أولاً لاقتراح أفضل وقت.");
  }
  try {
    const prompt = `
      بصفتك خبيرًا في وسائل التواصل الاجتماعي، قم بتحليل نص منشور فيسبوك التالي واقترح أفضل وقت في المستقبل لنشره لتحقيق أقصى قدر من التفاعل.
      الوقت الحالي هو: ${new Date().toISOString()}. يجب أن يكون الوقت المقترح بعد ساعة واحدة على الأقل من الوقت الحالي وفي غضون الأسبوع القادم.

      نص المنشور:
      "${postText}"

      أرجع الرد بتنسيق JSON فقط، بدون أي نص إضافي أو علامات markdown. يجب أن يحتوي كائن JSON على مفتاح واحد فقط "suggested_time_iso" بقيمة سلسلة زمنية بتنسيق ISO 8601.
      مثال: {"suggested_time_iso": "2024-08-25T17:00:00.000Z"}
    `;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                suggested_time_iso: { type: Type.STRING }
            }
        }
      },
    });

    const text = response.text;
    if (!text) {
        throw new Error("لم يتمكن الذكاء الاصطناعي من اقتراح وقت صالح (استجابة فارغة).");
    }

    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const data = JSON.parse(jsonStr);

    if (data && data.suggested_time_iso) {
      const suggestedDate = new Date(data.suggested_time_iso);
      if (suggestedDate.getTime() > Date.now()) {
        return suggestedDate;
      }
    }
    throw new Error("لم يتمكن الذكاء الاصطناعي من اقتراح وقت صالح.");

  } catch (error) {
    console.error("Error suggesting post time:", error);
    throw new Error("حدث خطأ أثناء اقتراح وقت النشر.");
  }
};

export const generateDescriptionForImage = async (ai: GoogleGenAI, imageFile: File, pageProfile?: PageProfile): Promise<string> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    const pageContext = createPageContext(pageProfile);
    const textPart = {
      text: `
      ${pageContext}
      أنت خبير في التسويق عبر وسائل التواصل الاجتماعي ومتخصص في كتابة الإعلانات (Copywriter).
      مهمتك هي كتابة وصف جذاب ومقنع كمنشور لفيسبوك بناءً على الصورة المرفقة وسياق الصفحة/العمل المقدم.
      
      يجب أن يكون الوصف:
      - باللغة العربية الفصيحة والجذابة.
      - متوافقًا تمامًا مع هوية العلامة التجارية الموضحة في سياق الصفحة.
      - محفزًا للتفاعل، ويجب أن ينتهي دائمًا بسؤال أو دعوة واضحة للعمل (Call to Action).
      
      **الأهم:** في دعوة العمل (CTA)، قم بدمج معلومات الاتصال أو العنوان أو الموقع الإلكتروني من "سياق الصفحة" بشكل طبيعي. 
      مثال: "للطلب والاستفسار، تواصلوا معنا على [رقم الهاتف] أو زوروا موقعنا [رابط الموقع]." أو "تفضلوا بزيارتنا في فرعنا بـ [العنوان] لتجربة فريدة!".
      
      - استخدم 2-3 إيموجي مناسبة لإضافة لمسة حيوية.
      - لا يزيد عن 4-5 أسطر.
      - ابدأ مباشرة بالوصف، لا تضع عنوانًا مثل "وصف مقترح:".
      `,
    };
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
    });
    
    return response.text ?? '';
  } catch (error) {
    console.error("Error generating description for image:", error);
    throw new Error("حدث خطأ أثناء إنشاء الوصف.");
  }
};


export const generateContentPlan = async (ai: GoogleGenAI, request: StrategyRequest, pageProfile?: PageProfile, images?: File[]): Promise<ContentPlanItem[]> => {
  try {
    const pageContext = createPageContext(pageProfile);
    let contentParts: any[] = [];
    
    let durationText: string;
    let postCountText: string;
    let strategyDetailsPrompt: string;

    switch(request.duration) {
      case 'weekly': durationText = 'أسبوع واحد (7 أيام)'; postCountText = '7 أفكار منشورات فريدة'; break;
      case 'monthly': durationText = 'شهر واحد (4 أسابيع)'; postCountText = `${request.postCount || 12} فكرة منشور فريدة`; break;
      case 'annual': durationText = 'سنة كاملة (12 شهرًا)'; postCountText = '12 موضوعًا شهريًا'; break;
    }

    switch(request.type) {
      case 'standard':
        strategyDetailsPrompt = `- نوع الاستراتيجية: خطة محتوى قياسية.\n- أعمدة المحتوى (Content Pillars) للتركيز عليها: ${request.pillars || 'متنوعة وشاملة'}.`;
        break;
      case 'campaign':
        strategyDetailsPrompt = `- نوع الاستراتيجية: حملة تسويقية.\n- اسم الحملة: ${request.campaignName || 'غير محدد'}\n- هدف الحملة: ${request.campaignObjective || 'غير محدد'}`;
        break;
      case 'occasion':
        strategyDetailsPrompt = `- نوع الاستراتيجية: حملة مبنية على مناسبة.\n- المناسبة: "${request.occasion}"\n- المطلوب: قم بإنشاء حملة تسويقية قصيرة ومتكاملة (3-5 أيام) حول هذه المناسبة.`;
        postCountText = '4 أفكار منشورات فريدة';
        break;
      case 'pillar':
        strategyDetailsPrompt = `- نوع الاستراتيجية: المحتوى المحوري (Pillar Content).\n- الموضوع المحوري الرئيسي: "${request.pillarTopic}"\n- المطلوب: قم بإنشاء فكرة منشور محوري واحد (طويل ومفصل)، ثم أنشئ 5-6 أفكار منشورات عنقودية (أصغر ومترابطة) تدعم الموضوع الرئيسي.`;
        postCountText = '7 أفكار منشورات فريدة';
        break;
      case 'images':
        if (images && images.length > 0) {
          strategyDetailsPrompt = `- نوع الاستراتيجية: مبنية على الصور المرفقة (${images.length} صور). لكل صورة، اقترح فكرة منشور فريدة ومناسبة.`;
          const imageParts = await Promise.all(images.map(fileToGenerativePart));
          contentParts.push(...imageParts);
          postCountText = `${images.length} فكرة منشور فريدة`;
        } else {
          throw new Error("يجب توفير صور لاستراتيجية المحتوى المبنية على الصور.");
        }
        break;
    }
    
    let mainPrompt: string;
    const responseSchema = {
        type: Type.ARRAY,
        items: {
            type: Type.OBJECT,
            properties: {
                day: { type: Type.STRING },
                theme: { type: Type.STRING },
                postSuggestion: { type: Type.STRING },
                contentType: { type: Type.STRING },
                cta: { type: Type.STRING },
            }
        }
    };

    if (request.duration === 'annual') {
       mainPrompt = `${pageContext}\nأنت خبير استراتيجي محترف للمحتوى. مهمتك هي إنشاء خطة محتوى سنوية عالية المستوى.\nتفاصيل الطلب:\n${strategyDetailsPrompt}\n- مدة الخطة: ${durationText}.\n- الجمهور المستهدف: ${request.audience}\n- الأهداف السنوية: ${request.goals}\n- النبرة المطلوبة: ${request.tone}\nالمطلوب:\nاقترح 12 موضوعًا رئيسيًا (Theme)، واحد لكل شهر. لكل موضوع، قدم شرحًا موجزًا.`;
    } else {
      mainPrompt = `${pageContext}\nأنت خبير استراتيجي محترف للمحتوى. مهمتك هي إنشاء خطة محتوى إبداعية ومتنوعة.\nتفاصيل الطلب:\n${strategyDetailsPrompt}\n- مدة الخطة: ${durationText}.\n- الجمهور المستهدف: ${request.audience}\n- الأهداف: ${request.goals}\n- النبرة المطلوبة: ${request.tone}\nالمطلوب:\nأنشئ خطة محتوى تحتوي على ${postCountText}.`;
    }
    
    contentParts.push({ text: mainPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: contentParts },
      config: {
        responseMimeType: 'application/json',
        responseSchema: responseSchema
      },
    });
    
    const text = response.text;
    if (!text) throw new Error("لم يتمكن الذكاء الاصطناعي من إنشاء خطة (استجابة فارغة).");
    const plan = JSON.parse(text.trim());
    if (Array.isArray(plan) && plan.length > 0 && plan[0].day && plan[0].postSuggestion) return plan;
    throw new Error("فشل الذكاء الاصطناعي في إنشاء خطة بالتنسيق المطلوب.");

  } catch (error) {
    console.error("Error generating content plan:", error);
    throw new Error("حدث خطأ أثناء إنشاء خطة المحتوى.");
  }
};


export const generateOptimalSchedule = async (ai: GoogleGenAI, plan: ContentPlanItem[]): Promise<{ postSuggestion: string, scheduledAt: string }[]> => {
  const planText = plan.map((item, i) => `${i + 1}. ${item.postSuggestion}`).join('\n');
  const prompt = `
    أنت خبير استراتيجي لجدولة المحتوى. مهمتك هي أخذ قائمة من منشورات المحتوى واقتراح أفضل تاريخ ووقت لنشر كل منها خلال الشهر القادم.
    تاريخ اليوم هو: ${new Date().toISOString()}. يجب أن تكون جميع الأوقات المقترحة في المستقبل. وزّع المنشورات بذكاء.
    قائمة المنشورات:
    ${planText}
  `;
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            postSuggestion: { type: Type.STRING },
                            scheduledAt: { type: Type.STRING }
                        }
                    }
                }
            },
        });
        const text = response.text;
        if (!text) throw new Error("لم يتمكن الذكاء الاصطناعي من إنشاء جدول زمني (استجابة فارغة).");
        const schedule = JSON.parse(text.trim());
        if (Array.isArray(schedule) && schedule.length > 0 && schedule[0].scheduledAt) return schedule;
        throw new Error("فشل الذكاء الاصطناعي في إنشاء جدول زمني بالتنسيق المطلوب.");
    } catch (error) {
        console.error("Error generating optimal schedule:", error);
        throw new Error("حدث خطأ أثناء إنشاء الجدول الزمني الأمثل.");
    }
};


export const generatePostInsights = async (
  ai: GoogleGenAI, 
  postText: string, 
  analytics: PostAnalytics, 
  comments: {message: string}[]
): Promise<{ performanceSummary: string, sentiment: { positive: number, negative: number, neutral: number } }> => {
  try {
    const commentsSample = comments.map(c => c.message).join('\n- ');
    const prompt = `
      أنت خبير تحليل وسائل التواصل الاجتماعي. حلل أداء منشور فيسبوك وتعليقاته وقدم رؤى.
      - النص: "${postText || '(صورة فقط)'}"
      - إعجابات: ${analytics.likes ?? 0}, تعليقات: ${analytics.comments ?? 0}, مشاركات: ${analytics.shares ?? 0}
      - عينة التعليقات: - ${commentsSample}
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
                performanceSummary: { type: Type.STRING },
                sentiment: {
                    type: Type.OBJECT,
                    properties: {
                        positive: { type: Type.NUMBER },
                        negative: { type: Type.NUMBER },
                        neutral: { type: Type.NUMBER }
                    }
                }
            }
        }
      },
    });
    
    const text = response.text;
    if (!text) throw new Error("لم يتمكن الذكاء الاصطناعي من إنشاء التحليل (استجابة فارغة).");
    const data = JSON.parse(text.trim());
    if (data && data.performanceSummary && data.sentiment) return data;
    throw new Error("فشل الذكاء الاصطناعي في إنشاء التحليل بالتنسيق المطلوب.");

  } catch (error) {
    console.error("Error generating post insights:", error);
    throw new Error("حدث خطأ أثناء إنشاء تحليل المنشور.");
  }
};

export const generatePerformanceSummary = async (
  ai: GoogleGenAI,
  summaryData: PerformanceSummaryData,
  pageProfile: PageProfile,
  period: '7d' | '30d'
): Promise<string> => {
    const pageContext = createPageContext(pageProfile);
    const topPostsText = summaryData.topPosts.map((p, i) => `${i+1}. "${p.text.substring(0, 50)}..." (تفاعل: ${(p.analytics.likes ?? 0) + (p.analytics.comments ?? 0) + (p.analytics.shares ?? 0)})`).join('\n');
    const periodText = period === '7d' ? 'الـ 7 أيام الماضية' : 'الـ 30 يومًا الماضية';

    const prompt = `
    ${pageContext}
    أنت محلل بيانات تسويقية. حلل الأداء العام لصفحة وقدم ملخصًا تنفيذيًا.
    بيانات الأداء لفترة ${periodText}:
    - الوصول: ${summaryData.totalReach}, التفاعل: ${summaryData.totalEngagement}, معدل التفاعل: ${(summaryData.engagementRate * 100).toFixed(2)}%, عدد المنشورات: ${summaryData.postCount}
    - أفضل المنشورات:
    ${topPostsText}
    اكتب فقرة واحدة (2-4 جمل) تلخص هذا الأداء، مع شرح السبب وتوصية استراتيجية.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text ?? 'لم يتمكن الذكاء الاصطناعي من إنشاء الملخص.';
    } catch(error) {
        console.error("Error generating performance summary:", error);
        throw new Error("حدث خطأ أثناء إنشاء ملخص الأداء.");
    }
};

export const generateSmartReplies = async (ai: GoogleGenAI, commentText: string, pageProfile?: PageProfile): Promise<string[]> => {
  const pageContext = createPageContext(pageProfile);
  const prompt = `
    ${pageContext}
    أنت مدير مجتمع. اقترح 3 ردود قصيرة واحترافية على تعليق العميل التالي:
    "${commentText}"
  `;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      },
    });

    const text = response.text;
    if (!text) throw new Error("لم يتمكن الذكاء الاصطناعي من اقتراح ردود (استجابة فارغة).");
    const replies = JSON.parse(text.trim());
    if (Array.isArray(replies) && replies.length > 0) return replies.slice(0, 3);
    throw new Error("فشل الذكاء الاصطناعي في إنشاء ردود بالتنسيق المطلوب.");
  } catch (error) {
    console.error("Error generating smart replies:", error);
    throw new Error("حدث خطأ أثناء اقتراح الردود الذكية.");
  }
};

export const generateAutoReply = async (ai: GoogleGenAI, userMessage: string, pageProfile?: PageProfile): Promise<string> => {
  const pageContext = createPageContext(pageProfile);
  const prompt = `
    ${pageContext}
    أنت مساعد خدمة عملاء ذكي لصفحة أعمال على فيسبوك. مهمتك هي الرد على رسالة/تعليق العميل التالي بشكل احترافي ومساعد.
    الرسالة/التعليق: "${userMessage}"
    
    التعليمات:
    1. اقرأ الرسالة جيدًا.
    2. استخدم "سياق الصفحة" المتاح أعلاه لصياغة رد دقيق.
    3. إذا كان السؤال عن سعر أو تفاصيل خدمة/منتج، قدم إجابة مباشرة من "سياق الصفحة".
    4. إذا كان السؤال عامًا، قدم إجابة ودودة ومساعدة.
    5. حافظ على نبرة احترافية.
    6. الرد يجب أن يكون باللغة العربية.
    7. لا تضف أي مقدمات أو عناوين. ابدأ بالرد مباشرة.
  `;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });
    return response.text ?? 'شكرًا لتواصلك، سيتم الرد عليك في أقرب وقت.';
  } catch (error) {
    console.error("Error generating auto-reply:", error);
    throw new Error("حدث خطأ أثناء إنشاء الرد التلقائي.");
  }
};

export const generateReplyVariations = async (ai: GoogleGenAI, baseReply: string): Promise<string[]> => {
  if (!baseReply.trim()) {
    throw new Error("لا يمكن إنشاء تنويعات من نص فارغ.");
  }
  const prompt = `
    أنت خبير في كتابة الإعلانات. مهمتك هي أخذ رسالة رد أساسية وإنشاء 3 تنويعات إبداعية لها.
    يجب أن تحافظ التنويعات على نفس المعنى ولكن بأساليب مختلفة (واحدة أكثر رسمية، واحدة أكثر وداً، وواحدة مختصرة).

    الرسالة الأساسية:
    "${baseReply}"

    أرجع الرد بتنسيق JSON فقط، على شكل مصفوفة من السلاسل النصية.
    مثال: ["الرد الأول", "الرد الثاني", "الرد الثالث"]
  `;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
        }
      },
    });
    
    const text = response.text;
    if (!text) throw new Error("لم يتمكن الذكاء الاصطناعي من اقتراح تنويعات (استجابة فارغة).");
    const variations = JSON.parse(text.trim());
    if (Array.isArray(variations) && variations.length > 0) return variations;
    throw new Error("فشل الذكاء الاصطناعي في إنشاء تنويعات بالتنسيق المطلوب.");
  } catch (error) {
    console.error("Error generating reply variations:", error);
    throw new Error("حدث خطأ أثناء إنشاء تنويعات الرد.");
  }
};
