

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
import { ContentPlanRequest, ContentPlanItem, PostAnalytics } from "../types";

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


export const initializeGoogleGenAI = (apiKey: string): GoogleGenAI | null => {
  if (!apiKey) {
    console.warn("API key is empty. Gemini client not initialized.");
    return null;
  }
  try {
    return new GoogleGenAI({ apiKey });
  } catch (error) {
    console.error("Failed to initialize GoogleGenAI:", error);
    return null;
  }
};

export const generatePostSuggestion = async (ai: GoogleGenAI, topic: string): Promise<string> => {
  try {
    const prompt = `
    أنت خبير في التسويق عبر وسائل التواصل الاجتماعي.
    مهمتك هي كتابة منشور جذاب لصفحة فيسبوك حول الموضوع التالي: "${topic}".
    يجب أن يكون المنشور:
    - باللغة العربية.
    - ودود ومحفز للنقاش.
    - يحتوي على سؤال أو دعوة للتفاعل (call to action).
    - يستخدم بعض الإيموجي المناسبة بشكل طبيعي.
    - لا تضع عنوانًا للمنشور، ابدأ مباشرة بالمحتوى.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
    });

    return response.text ?? '';
  } catch (error) {
    console.error("Error generating post suggestion:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
        throw new Error("مفتاح API غير صالح. يرجى التحقق منه في الإعدادات.");
    }
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
        if (error.message.includes('API key not valid')) {
            throw new Error("مفتاح API غير صالح. يرجى التحقق منه في الإعدادات.");
        }
        // Surface the actual error from the API to help debug configuration issues.
        detailedMessage = error.message;
    }
    // Provide a more informative error message to the user.
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
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
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
    if (error instanceof Error && error.message.includes('API key not valid')) {
        throw new Error("مفتاح API غير صالح. يرجى التحقق منه في الإعدادات.");
    }
    throw new Error("حدث خطأ أثناء اقتراح وقت النشر.");
  }
};

export const generateDescriptionForImage = async (ai: GoogleGenAI, imageFile: File): Promise<string> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    const textPart = {
      text: `
      أنت خبير في التسويق عبر وسائل التواصل الاجتماعي.
      مهمتك هي كتابة وصف جذاب وموجز كمنشور لفيسبوك بناءً على الصورة المرفقة.
      يجب أن يكون الوصف:
      - باللغة العربية.
      - ودود ومحفز للنقاش.
      - يحتوي على سؤال أو دعوة للتفاعل (call to action) مرتبطة بالصورة.
      - يستخدم 2-3 إيموجي مناسبة بشكل طبيعي.
      - لا يزيد عن 3-4 أسطر.
      - ابدأ مباشرة بالمحتوى، لا تضع عنوانًا مثل "وصف:".
      `,
    };
    
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: { parts: [imagePart, textPart] },
    });
    
    return response.text ?? '';
  } catch (error) {
    console.error("Error generating description for image:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
        throw new Error("مفتاح API غير صالح. يرجى التحقق منه في الإعدادات.");
    }
    throw new Error("حدث خطأ أثناء إنشاء الوصف.");
  }
};

export const generateContentPlan = async (ai: GoogleGenAI, request: ContentPlanRequest): Promise<ContentPlanItem[]> => {
  try {
    const prompt = `
      أنت خبير استراتيجي للمحتوى على وسائل التواصل الاجتماعي. مهمتك هي إنشاء خطة محتوى إبداعية ومتنوعة لمدة 7 أيام لصفحة فيسبوك.

      تفاصيل الصفحة:
      - نوع الصفحة: ${request.pageType}
      - الجمهور المستهدف: ${request.audience}
      - الأهداف الرئيسية: ${request.goals}
      - النبرة المطلوبة: ${request.tone}

      المطلوب:
      أنشئ خطة محتوى لمدة 7 أيام (من السبت إلى الجمعة). لكل يوم، قدم فكرة منشور فريدة ومناسبة للتفاصيل المذكورة أعلاه.

      الرجاء إرجاع الإجابة كـ JSON فقط، بدون أي نص إضافي أو علامات markdown.
      يجب أن تكون الإجابة عبارة عن مصفوفة JSON، حيث كل عنصر في المصفوفة هو كائن يمثل يومًا واحدًا ويحتوي على المفاتيح التالية بالضبط:
      - "day": (string) اسم اليوم باللغة العربية (مثال: "السبت").
      - "theme": (string) الفكرة العامة أو الموضوع الرئيسي لليوم (مثال: "مشاركة من وراء الكواليس").
      - "postSuggestion": (string) نص المنشور المقترح بالكامل، يجب أن يكون جذابًا ويتضمن دعوة للعمل (CTA) وإيموجيز مناسبة.
      - "contentType": (string) نوع المحتوى المقترح (مثال: "صورة عالية الجودة"، "فيديو قصير (Reel)"، "استطلاع رأي").
      - "cta": (string) دعوة للعمل واضحة ومختصرة (مثال: "شاركنا رأيك في التعليقات!", "اطلب الآن عبر موقعنا").

      مثال على عنصر واحد في المصفوفة:
      {
        "day": "السبت",
        "theme": "بداية أسبوع قوية",
        "postSuggestion": "بداية أسبوع جديد مليء بالفرص! 🤩 ما هو الهدف الأكبر الذي تسعون لتحقيقه هذا الأسبوع؟ شاركونا طموحاتكم لنلهم بعضنا البعض! #أهداف_الأسبوع #إلهام",
        "contentType": "سؤال تفاعلي",
        "cta": "شاركنا هدفك الأسبوعي!"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const text = response.text;
    if (!text) {
        throw new Error("لم يتمكن الذكاء الاصطناعي من إنشاء خطة (استجابة فارغة).");
    }

    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const plan = JSON.parse(jsonStr);
    
    // Basic validation
    if (Array.isArray(plan) && plan.length > 0 && plan[0].day && plan[0].postSuggestion) {
      return plan;
    }

    throw new Error("فشل الذكاء الاصطناعي في إنشاء خطة بالتنسيق المطلوب.");

  } catch (error) {
    console.error("Error generating content plan:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
        throw new Error("مفتاح API غير صالح. يرجى التحقق منه في الإعدادات.");
    }
    throw new Error("حدث خطأ أثناء إنشاء خطة المحتوى.");
  }
};


export const analyzePageForContentPlan = async (ai: GoogleGenAI, pageName: string, pageType: 'page' | 'group' | 'instagram'): Promise<Partial<ContentPlanRequest>> => {
  try {
    let typeForPrompt: string;
    if (pageType === 'instagram') {
      typeForPrompt = 'حساب انستجرام للأعمال';
    } else if (pageType === 'group') {
      typeForPrompt = 'مجموعة';
    } else {
      typeForPrompt = 'صفحة عامة';
    }
    
    const prompt = `
      أنت خبير استراتيجي في التسويق الرقمي.
      بناءً على اسم ونوع صفحة فيسبوك التالية، قم بتحليل واقتراح استراتيجية محتوى أولية.

      - اسم الصفحة: "${pageName}"
      - نوعها: "${typeForPrompt}"

      المطلوب:
      قم بإرجاع كائن JSON فقط، بدون أي نص إضافي أو علامات markdown.
      يجب أن يحتوي الكائن على المفاتيح التالية:
      - "pageType": (string) وصف موجز لنوع العمل أو الصفحة (مثال: "متجر إلكتروني للملابس", "مدونة تقنية", "مطعم مأكولات بحرية").
      - "audience": (string) وصف للجمهور المستهدف المحتمل (مثال: "الشباب المهتمون بالموضة", "المطورون والمبرمجون", "العائلات ومحبو الطعام").
      - "goals": (string) الأهداف التسويقية الرئيسية المقترحة (مثال: "زيادة الوعي بالعلامة التجارية وبيع المنتجات", "بناء مجتمع تفاعلي", "جذب الحجوزات").
      - "tone": (string) النبرة الأنسب للمحتوى من بين هذه الخيارات ["ودود ومرح", "احترافي ورسمي", "تعليمي وملهم", "مثير للحماس والطاقة"]. اختر الأنسب.

      مثال على الإجابة:
      {
        "pageType": "مقهى ومحمصة بن",
        "audience": "طلاب الجامعات والموظفون عن بعد ومحبو القهوة",
        "goals": "زيادة عدد زوار المقهى وبناء ولاء للعلامة التجارية",
        "tone": "ودود ومرح"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("لم يتمكن الذكاء الاصطناعي من تحليل الصفحة (استجابة فارغة).");
    }

    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }

    const analysis = JSON.parse(jsonStr);
    
    if (analysis && analysis.pageType && analysis.audience) {
      return analysis;
    }

    throw new Error("فشل التحليل في إعادة البيانات بالتنسيق المطلوب.");

  } catch (error) {
    console.error("Error analyzing page for content plan:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
        throw new Error("مفتاح API غير صالح. يرجى التحقق منه في الإعدادات.");
    }
    throw new Error("حدث خطأ أثناء تحليل الصفحة.");
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
      أنت خبير تحليل وسائل التواصل الاجتماعي. مهمتك هي تحليل أداء منشور فيسبوك وتعليقاته وتقديم رؤى قابلة للتنفيذ باللغة العربية.

      تفاصيل المنشور:
      - النص: "${postText || '(منشور يحتوي على صورة فقط)'}"
      - عدد الإعجابات: ${analytics.likes ?? 0}
      - عدد التعليقات: ${analytics.comments ?? 0}
      - عدد المشاركات: ${analytics.shares ?? 0}

      عينة من التعليقات (أول 25 تعليق):
      - ${commentsSample}

      المطلوب:
      أرجع ردك ككائن JSON فقط، بدون أي نص إضافي أو علامات markdown.
      يجب أن يحتوي كائن JSON على المفاتيح التالية:
      1.  "performanceSummary": (string) ملخص موجز ومتبصر (2-3 جمل) باللغة العربية حول أداء هذا المنشور. اشرح لماذا تعتقد أنه حقق هذا الأداء (مثلاً، هل السؤال المطروح كان جيدًا؟ هل الصورة كانت جذابة؟). إذا أمكن، قارن أداءه بشكل عام (مثلاً، "أداء أعلى من المتوسط"، "تفاعل جيد").
      2.  "sentiment": (object) كائن يمثل تحليل المشاعر في التعليقات. يجب أن يحتوي على ثلاثة مفاتيح:
          - "positive": (number) نسبة مئوية (من 0.0 إلى 1.0) للتعليقات الإيجابية.
          - "negative": (number) نسبة مئوية (من 0.0 إلى 1.0) للتعليقات السلبية.
          - "neutral": (number) نسبة مئوية (من 0.0 إلى 1.0) للتعليقات المحايدة.
          (يجب أن يكون مجموع النسب الثلاثة يساوي 1.0)

      مثال على الإجابة:
      {
        "performanceSummary": "حقق هذا المنشور تفاعلاً ممتازًا، خاصة في عدد التعليقات، مما يشير إلى أن السؤال المباشر للجمهور كان ناجحًا جدًا في إثارة النقاش. استخدام الإيموجي أضاف لمسة ودية وشجع على المشاركة.",
        "sentiment": {
          "positive": 0.85,
          "negative": 0.05,
          "neutral": 0.10
        }
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });
    
    const text = response.text;
    if (!text) {
        throw new Error("لم يتمكن الذكاء الاصطناعي من إنشاء التحليل (استجابة فارغة).");
    }

    let jsonStr = text.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const match = jsonStr.match(fenceRegex);
    if (match && match[2]) {
      jsonStr = match[2].trim();
    }
    
    const data = JSON.parse(jsonStr);

    if (data && data.performanceSummary && data.sentiment) {
      return data;
    }

    throw new Error("فشل الذكاء الاصطناعي في إنشاء التحليل بالتنسيق المطلوب.");

  } catch (error) {
    console.error("Error generating post insights:", error);
    if (error instanceof Error && error.message.includes('API key not valid')) {
        throw new Error("مفتاح API غير صالح. يرجى التحقق منه في الإعدادات.");
    }
    throw new Error("حدث خطأ أثناء إنشاء تحليل المنشور.");
  }
};
