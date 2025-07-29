import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";

export async function GET(request: NextRequest) {
  try {
    // Check environment variables
    const envCheck = {
      MYSQL_HOST: process.env.MYSQL_HOST || "NOT_SET",
      MYSQL_PORT: process.env.MYSQL_PORT || "NOT_SET", 
      MYSQL_USER: process.env.MYSQL_USER || "NOT_SET",
      MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ? "SET" : "NOT_SET",
      MYSQL_DATABASE: process.env.MYSQL_DATABASE || "NOT_SET",
    };

    // Test database connection
    let dbTest = "FAILED";
    let tableCheck = "FAILED";
    let departmentCount = 0;

    try {
      // Test basic connection
      await query("SELECT 1 as test");
      dbTest = "SUCCESS";

      // Check if department table exists
      const tables = await query("SHOW TABLES LIKE 'department'") as any[];
      tableCheck = tables.length > 0 ? "EXISTS" : "NOT_FOUND";

      // Count departments
      const deptResult = await query("SELECT COUNT(*) as count FROM department") as any[];
      departmentCount = deptResult[0]?.count || 0;

    } catch (dbError) {
      dbTest = `ERROR: ${dbError instanceof Error ? dbError.message : String(dbError)}`;
    }

    return NextResponse.json({
      success: true,
      environment: envCheck,
      database: {
        connection: dbTest,
        departmentTable: tableCheck,
        departmentCount: departmentCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
} 