// app/api/users/route.ts
import { NextResponse } from "next/server";
import { hash } from "bcrypt";
import { query } from "@/app/lib/db";

export async function GET() {
  try {
    const users = await query(`
      SELECT 
        u.id, u.username, u.email, u.role, u.is_active, 
        u.created_at, u.last_login, d.Department_Name as department
      FROM users u
      LEFT JOIN department d ON u.department_id = d.Department_ID
      ORDER BY u.created_at DESC
    `);

    return NextResponse.json({
      success: true,
      data: users,
    });
  } catch (error) {
    console.error("Error fetching users:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error fetching users",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { username, email, password, role, departmentId, isActive } = body;

    // Validate required fields
    if (!username || !email || !password || !role) {
      return NextResponse.json(
        {
          success: false,
          message: "Missing required fields",
        },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(password, 10);

    // Create user
    const result = await query(
      `
      INSERT INTO users (
        username, email, password, role, department_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?)
      `,
      [
        username,
        email,
        hashedPassword,
        role,
        departmentId || null,
        isActive || true,
      ]
    );

    return NextResponse.json({
      success: true,
      message: "User created successfully",
      userId: result.insertId,
    });
  } catch (error) {
    console.error("Error creating user:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error creating user",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
