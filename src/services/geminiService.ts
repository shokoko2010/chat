


import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

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
