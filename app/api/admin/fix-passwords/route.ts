import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import { hash } from "bcrypt";

export async function POST(request: NextRequest) {
  // This endpoint should only be accessible in development environment
  //if (process.env.NODE_ENV === "production") {
    //return NextResponse.json(
     // { success: false, message: "This endpoint is not available in production" },
     // { status: 403 }
   // );
  //}

  try {
    const { email, newPassword, adminKey } = await request.json();

    // Basic admin validation
    if (adminKey !== "ims2025_admin") {
      return NextResponse.json(
        { success: false, message: "Invalid admin key" },
        { status: 401 }
      );
    }

    // Validate input
    if (!email || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Email and new password are required" },
        { status: 400 }
      );
    }

    // Check if user exists
    const users = await query(
      `SELECT id, username, email FROM users WHERE email = ? LIMIT 1`,
      [email]
    );

    if (!users || !Array.isArray(users) || users.length === 0) {
      return NextResponse.json(
        { success: false, message: "User not found" },
        { status: 404 }
      );
    }

    const user = users[0];

    // Hash the new password
    const hashedPassword = await hash(newPassword, 10);

    // Update user's password
    await query(
      `UPDATE users SET password = ? WHERE id = ?`,
      [hashedPassword, user.id]
    );

    // Make sure user is active
    await query(
      `UPDATE users SET is_active = 1 WHERE id = ?`,
      [user.id]
    );

    return NextResponse.json({
      success: true,
      message: `Password updated for ${email}`,
      user: {
        id: user.id,
        email: user.email,
        username: user.username
      }
    });
  } catch (error) {
    console.error("Fix password error:", error);
    return NextResponse.json(
      { success: false, message: "Error fixing password", error: String(error) },
      { status: 500 }
    );
  }
}

// Utility endpoint to list users for debugging
export async function GET(request: NextRequest) {
  // This endpoint should only be accessible in development environment
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { success: false, message: "This endpoint is not available in production" },
      { status: 403 }
    );
  }

  try {
    const url = new URL(request.url);
    const adminKey = url.searchParams.get("adminKey");

    // Basic admin validation
    if (adminKey !== "ims2025_admin") {
      return NextResponse.json(
        { success: false, message: "Invalid admin key" },
        { status: 401 }
      );
    }

    // Get list of users
    const users = await query(
      `
      SELECT 
        id, username, email, role, name, is_active, 
        DATE_FORMAT(last_login, '%Y-%m-%d %H:%i:%s') as last_login,
        DATE_FORMAT(created_at, '%Y-%m-%d %H:%i:%s') as created_at
      FROM users
      ORDER BY id
      `
    );

    return NextResponse.json({
      success: true,
      users: users,
    });
  } catch (error) {
    console.error("List users error:", error);
    return NextResponse.json(
      { success: false, message: "Error listing users", error: String(error) },
      { status: 500 }
    );
  }
} 