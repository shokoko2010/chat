
import { GoogleGenAI } from "@google/genai";

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
