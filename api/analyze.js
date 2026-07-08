export default async function handler(req, res) {
  return res.status(200).json({
    hasKey: !!process.env.OPENROUTER_API_KEY,
    firstFive: process.env.OPENROUTER_API_KEY
      ? process.env.OPENROUTER_API_KEY.substring(0, 5)
      : null
  });
}