

import { GoogleGenAI, GenerateContentResponse } from "@google/genai";
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
    - معلومات الاتصال: ${pageProfile.contactInfo || 'غير محدد'}
    - الموقع الإلكتروني: ${pageProfile.website || 'غير محدد'}
    - العروض الحالية: ${pageProfile.currentOffers || 'غير محدد'}
    ---
  `;
};

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

export const analyzePageForProfile = async (ai: GoogleGenAI, pageName: string, pageCategory?: string): Promise<PageProfile> => {
    const prompt = `
    أنت خبير استراتيجي في الأعمال والتسويق الرقمي.
    بناءً على اسم الصفحة والفئة المعطاة، قم بإنشاء ملف تعريف (profile) افتراضي ومقترح لهذا العمل.
    
    - اسم الصفحة: "${pageName}"
    - فئة الصفحة (إن وجدت): "${pageCategory || 'غير محدد'}"
    
    المطلوب:
    أرجع كائن JSON فقط، بدون أي نص إضافي أو علامات markdown.
    يجب أن يحتوي الكائن على المفاتيح التالية بقيم مقترحة ومقنعة باللغة العربية:
    - "description": (string) وصف موجز وجذاب للعمل (من نحن؟).
    - "services": (string) قائمة بالمنتجات أو الخدمات المحتملة التي يقدمها العمل، مفصولة بفاصلة.
    - "contactInfo": (string) معلومات اتصال افتراضية (هاتف، بريد إلكتروني).
    - "website": (string) رابط موقع إلكتروني افتراضي.
    - "currentOffers": (string) اقتراح لعرض خاص أو حملة حالية (مثال: خصم ترحيبي 15%).
    
    مثال على الإجابة لصفحة اسمها "مقهى ركن القهوة":
    {
      "description": "مقهى ركن القهوة هو وجهتكم المثالية للاستمتاع بأجود أنواع القهوة المختصة والمشروبات المبتكرة في أجواء مريحة وملهمة. نفخر بتقديم تجربة فريدة تجمع بين النكهة الأصيلة والإبداع.",
      "services": "قهوة مختصة، مشروبات باردة وساخنة، مخبوزات طازجة، حلويات، حبوب بن للبيع",
      "contactInfo": "966555123456+، hello@cornercafe.com",
      "website": "https://cornercafe.sa",
      "currentOffers": "خصم 15% على أول طلب عبر التطبيق"
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
      throw new Error("لم يتمكن الذكاء الاصطناعي من إنشاء ملف تعريف (استجابة فارغة).");
  }
  let jsonStr = text.trim();
  const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
  const match = jsonStr.match(fenceRegex);
  if (match && match[2]) {
    jsonStr = match[2].trim();
  }
  
  const data = JSON.parse(jsonStr);
  if (data && data.description) {
      return data;
  }
  throw new Error("فشل التحليل في إعادة البيانات بالتنسيق المطلوب.");
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

export const generateDescriptionForImage = async (ai: GoogleGenAI, imageFile: File, pageProfile?: PageProfile): Promise<string> => {
  try {
    const imagePart = await fileToGenerativePart(imageFile);
    const pageContext = createPageContext(pageProfile);
    const textPart = {
      text: `
      ${pageContext}
      أنت خبير في التسويق عبر وسائل التواصل الاجتماعي.
      مهمتك هي كتابة وصف جذاب وموجز كمنشور لفيسبوك بناءً على الصورة المرفقة وسياق الصفحة.
      يجب أن يكون الوصف:
      - باللغة العربية.
      - متوافقًا مع هوية العلامة التجارية الموضحة في سياق الصفحة.
      - ودود ومحفز للنقاش.
      - يحتوي على سؤال أو دعوة للتفاعل (call to action) مرتبطة بالصورة وسياق العمل.
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


export const generateContentPlan = async (ai: GoogleGenAI, request: StrategyRequest, pageProfile?: PageProfile, images?: File[]): Promise<ContentPlanItem[]> => {
  try {
    const pageContext = createPageContext(pageProfile);
    let contentParts: any[] = [];
    
    // --- Build Dynamic Prompt Parts ---
    let durationText: string;
    let postCount: number;
    let strategyDetailsPrompt: string;

    switch(request.duration) {
      case 'weekly': durationText = 'أسبوع واحد (7 أيام)'; postCount = 7; break;
      case 'monthly': durationText = 'شهر واحد (4 أسابيع)'; postCount = 20; break;
      case 'annual': durationText = 'سنة كاملة (12 شهرًا)'; postCount = 12; break; // 12 monthly themes
    }

    switch(request.type) {
      case 'standard':
        strategyDetailsPrompt = `
          - نوع الاستراتيجية: خطة محتوى قياسية.
          - أعمدة المحتوى (Content Pillars) للتركيز عليها: ${request.pillars || 'متنوعة وشاملة'}.
        `;
        break;
      case 'campaign':
        strategyDetailsPrompt = `
          - نوع الاستراتيجية: حملة تسويقية.
          - اسم الحملة: ${request.campaignName || 'غير محدد'}
          - هدف الحملة: ${request.campaignObjective || 'غير محدد'}
        `;
        break;
      case 'occasion':
        strategyDetailsPrompt = `
          - نوع الاستراتيجية: حملة مبنية على مناسبة.
          - المناسبة: "${request.occasion}"
          - المطلوب: قم بإنشاء حملة تسويقية قصيرة ومتكاملة (3-5 أيام) حول هذه المناسبة. يجب أن تكون الحملة متوافقة تمامًا مع "سياق الصفحة/العمل" المقدم. يجب أن تتضمن الحملة منشورات متنوعة (مثلاً: تشويق، إعلان عن عرض، تفاعل، شكر).
        `;
        postCount = 4; // Override for this strategy to get a multi-day campaign
        break;
      case 'pillar':
        strategyDetailsPrompt = `
          - نوع الاستراتيجية: المحتوى المحوري (Pillar Content).
          - الموضوع المحوري الرئيسي: "${request.pillarTopic}"
          - المطلوب: قم بإنشاء فكرة منشور محوري واحد (طويل ومفصل)، ثم أنشئ 5-6 أفكار منشورات عنقودية (أصغر ومترابطة) تدعم الموضوع الرئيسي.
        `;
        postCount = 7; // Override for this strategy
        break;
      case 'images':
        if (images && images.length > 0) {
          strategyDetailsPrompt = `- نوع الاستراتيجية: مبنية على الصور المرفقة (${images.length} صور). لكل صورة، اقترح فكرة منشور فريدة ومناسبة.`;
          const imageParts = await Promise.all(images.map(fileToGenerativePart));
          contentParts.push(...imageParts);
        } else {
          throw new Error("يجب توفير صور لاستراتيجية المحتوى المبنية على الصور.");
        }
        break;
    }
    
    // --- Build Final Prompt ---
    let mainPrompt: string;
    
    if (request.duration === 'annual') {
       mainPrompt = `
        ${pageContext}
        أنت خبير استراتيجي محترف للمحتوى على وسائل التواصل الاجتماعي. مهمتك هي إنشاء **خطة محتوى سنوية عالية المستوى**.

        تفاصيل الطلب:
        ${strategyDetailsPrompt}
        - مدة الخطة: ${durationText}.
        - الجمهور المستهدف: ${request.audience}
        - الأهداف السنوية: ${request.goals}
        - النبرة المطلوبة: ${request.tone}

        المطلوب:
        اقترح **12 موضوعًا رئيسيًا (Theme)**، واحد لكل شهر من شهور السنة.
        لكل موضوع، قدم شرحًا موجزًا من جملة واحدة.
        
        الرجاء إرجاع الإجابة كـ JSON فقط، بدون أي نص إضافي أو علامات markdown.
        يجب أن تكون الإجابة عبارة عن مصفوفة JSON، حيث كل عنصر في المصفوفة هو كائن يمثل شهرًا واحدًا ويحتوي على المفاتيح التالية بالضبط:
        - "day": (string) اسم الشهر (مثال: "يناير", "فبراير").
        - "theme": (string) الموضوع الرئيسي المقترح للشهر.
        - "postSuggestion": (string) شرح موجز للموضوع وأفكار للمحتوى خلاله.
        - "contentType": (string) نوع المحتوى العام المقترح لهذا الشهر (مثال: "بناء الوعي", "إطلاق منتجات").
        - "cta": (string) دعوة للعمل رئيسية للشهر (مثال: "تابعونا لتعرفوا المزيد").
       `;
    } else { // Weekly or Monthly
      mainPrompt = `
        ${pageContext}
        أنت خبير استراتيجي محترف للمحتوى على وسائل التواصل الاجتماعي. مهمتك هي إنشاء خطة محتوى إبداعية ومتنوعة لصفحة فيسبوك بناءً على التفاصيل التالية.

        تفاصيل الطلب:
        ${strategyDetailsPrompt}
        - مدة الخطة: ${durationText}.
        - الجمهور المستهدف: ${request.audience}
        - الأهداف: ${request.goals}
        - النبرة المطلوبة: ${request.tone}

        المطلوب:
        أنشئ خطة محتوى تحتوي على ${postCount} فكرة منشور فريدة.
        ${request.duration === 'monthly' ? 'قسّم الخطة إلى 4 أسابيع، مع تحديد থيم (موضوع) لكل أسبوع.' : ''}
        ${request.type === 'occasion' ? 'قم بتسمية الأيام بشكل تسلسلي (مثال: اليوم 1: تشويق، اليوم 2: العرض الرئيسي).': ''}

        الرجاء إرجاع الإجابة كـ JSON فقط، بدون أي نص إضافي أو علامات markdown.
        يجب أن تكون الإجابة عبارة عن مصفوفة JSON، حيث كل عنصر في المصفوفة هو كائن يمثل يومًا واحدًا ويحتوي على المفاتيح التالية بالضبط:
        - "day": (string) اليوم أو الأسبوع (مثال: "الأسبوع 1 - الاثنين" أو "السبت" أو "اليوم 1: التشويق").
        - "theme": (string) الفكرة العامة أو الموضوع الرئيسي (مثال: "مشاركة من وراء الكواليس" أو "الاستعداد لليوم الوطني").
        - "postSuggestion": (string) نص المنشور المقترح بالكامل، يجب أن يكون جذابًا ومتوافقًا مع سياق الصفحة والطلب، ويتضمن دعوة للعمل (CTA) وإيموجيز مناسبة.
        - "contentType": (string) نوع المحتوى المقترح (مثال: "صورة عالية الجودة"، "فيديو قصير (Reel)"، "استطلاع رأي").
        - "cta": (string) دعوة للعمل واضحة ومختصرة (مثال: "شاركنا رأيك في التعليقات!", "اطلب الآن عبر موقعنا").
      `;
    }
    
    contentParts.push({ text: mainPrompt });

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-04-17',
      contents: { parts: contentParts },
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
    أنت خبير ومحلل بيانات تسويقية. مهمتك هي تحليل الأداء العام لصفحة على وسائل التواصل الاجتماعي وتقديم ملخص تنفيذي موجز وذكي باللغة العربية.

    بيانات الأداء لفترة ${periodText}:
    - إجمالي الوصول (Reach): ${summaryData.totalReach}
    - إجمالي التفاعل (Engagement): ${summaryData.totalEngagement}
    - معدل التفاعل (Engagement Rate): ${(summaryData.engagementRate * 100).toFixed(2)}%
    - عدد المنشورات: ${summaryData.postCount}
    - أفضل المنشورات أداءً:
    ${topPostsText}

    المطلوب:
    اكتب فقرة واحدة فقط (2-4 جمل) تلخص هذا الأداء.
    - ابدأ ببيان عام (مثال: "أداء هذا الأسبوع كان قويًا...")
    - اشرح السبب المحتمل وراء الأداء الجيد أو الضعيف بناءً على البيانات (مثال: "يبدو أن المنشورات التي تحتوي على أسئلة مباشرة تحقق أعلى تفاعل").
    - اختتم بتوصية استراتيجية واضحة وقابلة للتنفيذ للخطوة التالية (مثال: "نوصي بالتركيز على إنشاء المزيد من محتوى الفيديو القصير").
    - يجب أن يكون التحليل متوافقًا مع "سياق الصفحة/العمل" المقدم.
    `;
    
    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash-preview-04-17',
            contents: prompt,
        });
        return response.text ?? 'لم يتمكن الذكاء الاصطناعي من إنشاء الملخص.';
    } catch(error) {
        console.error("Error generating performance summary:", error);
        throw new Error("حدث خطأ أثناء إنشاء ملخص الأداء.");
    }
};