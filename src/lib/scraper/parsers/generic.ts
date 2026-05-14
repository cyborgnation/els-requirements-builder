export function extractMainContent(html: string): string {
  let text = html;

  // Remove script and style tags with content
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<footer[\s\S]*?<\/footer>/gi, "");
  text = text.replace(/<header[\s\S]*?<\/header>/gi, "");

  // Try to extract main/article content first
  const mainMatch = text.match(/<main[\s\S]*?>([\s\S]*?)<\/main>/i);
  const articleMatch = text.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i);
  const contentMatch = text.match(
    /<div[^>]*(?:class|id)="[^"]*content[^"]*"[^>]*>([\s\S]*?)<\/div>/i
  );

  const contentHtml =
    mainMatch?.[1] || articleMatch?.[1] || contentMatch?.[1] || text;

  // Convert common block elements to newlines
  let result = contentHtml;
  result = result.replace(/<br\s*\/?>/gi, "\n");
  result = result.replace(/<\/p>/gi, "\n\n");
  result = result.replace(/<\/div>/gi, "\n");
  result = result.replace(/<\/h[1-6]>/gi, "\n\n");
  result = result.replace(/<\/li>/gi, "\n");
  result = result.replace(/<li[^>]*>/gi, "  • ");
  result = result.replace(/<\/tr>/gi, "\n");
  result = result.replace(/<td[^>]*>/gi, " | ");
  result = result.replace(/<th[^>]*>/gi, " | ");

  // Strip remaining HTML tags
  result = result.replace(/<[^>]+>/g, "");

  // Decode HTML entities
  result = result.replace(/&amp;/g, "&");
  result = result.replace(/&lt;/g, "<");
  result = result.replace(/&gt;/g, ">");
  result = result.replace(/&quot;/g, '"');
  result = result.replace(/&#39;/g, "'");
  result = result.replace(/&nbsp;/g, " ");

  // Normalize whitespace
  result = result.replace(/[ \t]+/g, " ");
  result = result.replace(/\n{3,}/g, "\n\n");
  result = result.trim();

  return result;
}
