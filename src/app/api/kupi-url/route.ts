import { NextResponse } from "next/server";

const BASE_SLEVY = "https://www.kupi.cz/slevy/";
const BASE_SEARCH = "https://www.kupi.cz/hledej?vse=0&f=";
const QUERY_SUFFIX = "?sh3=3&sh5=5&sh27=27&sh4=4&sh6=6&sh7=7";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const item = url.searchParams.get("item")?.trim();

  if (!item) {
    return NextResponse.json({ url: null }, { status: 400 });
  }

  const slug = encodeURIComponent(item.toLowerCase());
  const primaryUrl = `${BASE_SLEVY}${slug}${QUERY_SUFFIX}`;
  let finalUrl = primaryUrl;

  try {
    const res = await fetch(primaryUrl, { method: "HEAD" });
    if (!res.ok || res.status === 404) {
      finalUrl = `${BASE_SEARCH}${encodeURIComponent(item)}`;
    }
  } catch {
    finalUrl = `${BASE_SEARCH}${encodeURIComponent(item)}`;
  }

  return NextResponse.json({ url: finalUrl });
}

