import {
  GoogleGenerativeAI,
  HarmBlockThreshold,
  HarmCategory,
} from "@google/generative-ai";

const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || "";

const genAI = new GoogleGenerativeAI(apiKey);
const model = genAI.getGenerativeModel({
  model: "gemini-1.5-pro-latest",
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE,
    },
  ],
});

type FilterParameter = {
  logicalOperator: string;
  name: string;
  operator: string;
  filterVariable: string;
  filterVariable2?: string;
  salaryCurr?: string;
  salaryPeriod?: string;
  country?: string;
};

type QueryFilter = {
  filterParameters: FilterParameter[];
  query: string;
  isFavoriteApplicant: boolean;
  jobListingId: null | string;
};

export async function generateFilterFromPrompt(
  prompt: string
): Promise<QueryFilter | null> {
  if (!prompt) {
    console.error("Prompt is empty");
    return null;
  }

  try {
    const result = await model.generateContent(`
      Given the following prompt from a user, generate a structured query filter for a GraphQL API.
      Prompt: "${prompt}"
      
      Return a valid JSON object that follows this structure:
      {
        "filterParameters": [
          {
            "logicalOperator": "AND", // Can be AND, OR
            "name": "fieldName", // Supported fields: salary, fullName, email, address, etc.
            "operator": "operatorType", // Can be: equals, contains, between, gte, lte
            "filterVariable": "value1",
            "filterVariable2": "value2", // Only needed for 'between' operator
            "salaryCurr": "currencyCode", // Only for salary - USD, EUR, etc.
            "salaryPeriod": "period" // Only for salary - MONTHLY, YEARLY, etc.
          }
        ],
        "query": "", // Should be empty string
        "isFavoriteApplicant": false, // Set to true only if prompt explicitly mentions favorites
        "jobListingId": null // Should be null
      }

      Important operator mappings:
      - For greater than: use "gte" (not "greaterThan")
      - For less than: use "lte" (not "lessThan")
      - For equality: use "equals"
      - For contains: use "contains"
      - For between: use "between" (requires both filterVariable and filterVariable2)

      For location filters:
      - If the user mentions a country (e.g., "Germany"), use name="address", operator="contains", filterVariable="Germany"

      For salary filters:
      - Always use name="salary" 
      - Include salaryCurr (e.g., "EUR") and salaryPeriod (e.g., "MONTHLY" or "YEARLY")
      - For ranges, use operator="between" with filterVariable and filterVariable2
      - For minimums, use operator="gte" with filterVariable
      - For maximums, use operator="lte" with filterVariable

      For example, for "Candidates from Germany with salary above 2000 Euro per month", 
      the filter would include these parameters:
      [
        {
          "logicalOperator": "AND",
          "name": "address",
          "operator": "contains", 
          "filterVariable": "Germany"
        },
        {
          "logicalOperator": "AND",
          "name": "salary",
          "operator": "gte",
          "filterVariable": "2000",
          "salaryCurr": "EUR",
          "salaryPeriod": "MONTHLY"
        }
      ]

      Return ONLY the structured JSON without any explanations or preamble.
    `);

    const text = result.response.text();

    if (!text) {
      console.error("No response text from AI");
      return null;
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error("No JSON found in response:", text);
      return null;
    }

    const jsonStr = jsonMatch[0];
    const parsedFilter = JSON.parse(jsonStr) as QueryFilter;

    return parsedFilter;
  } catch (error) {
    console.error("Error generating filter:", error);
    return null;
  }
}
