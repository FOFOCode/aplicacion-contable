import { NextResponse } from "next/server"
import { isDbConnected } from "@/lib/db"

export async function GET() {
  const connected = await isDbConnected()
  return NextResponse.json({ connected })
}
