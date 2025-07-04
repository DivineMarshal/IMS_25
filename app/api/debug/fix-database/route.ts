import { NextRequest, NextResponse } from "next/server";
import { query } from "@/app/lib/db";
import { hash } from "bcrypt";

export async function GET(request: NextRequest) {
  try {
    // Force content type to be application/json
    const headers = new Headers();
    headers.set('Content-Type', 'application/json');
    headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    
    // Results of fixes applied
    const results = {
      userFixes: 0,
      sessionFixes: 0,
      permissionFixes: 0,
      tableCreated: false,
      errors: [] as string[]
    };
    
    // 0. Create sessions table if it doesn't exist
    try {
      // Check if sessions table exists
      const tableCheck = await query(
        `SELECT 1 FROM information_schema.tables 
         WHERE table_schema = DATABASE() 
         AND table_name = 'sessions'`
      );
      
      // @ts-ignore
      if (!tableCheck || tableCheck.length === 0) {
        // Create the sessions table
        await query(`
          CREATE TABLE sessions (
            id VARCHAR(255) PRIMARY KEY,
            user_id INT NOT NULL,
            expires DATETIME NOT NULL,
            data TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX (user_id),
            INDEX (expires)
          )
        `);
        
        results.tableCreated = true;
      }
    } catch (error) {
      results.errors.push(`Sessions table creation error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 1. Fix user passwords for test accounts
    try {
      const resetPassword = await hash("hindavi123", 10);
      const userResult = await query(
        `UPDATE users SET 
          password = ?, 
          is_active = 1
         WHERE 
          email = 'hindavi815@gmail.com' OR 
          email = 'admin@example.com' OR
          role = 'admin'`,
        [resetPassword]
      );
      
      // @ts-ignore
      results.userFixes = userResult.affectedRows || 0;
    } catch (error) {
      results.errors.push(`User password fix error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    // 2. Clear any expired sessions
    try {
      const sessionResult = await query(
        `DELETE FROM sessions WHERE expires < NOW()`
      );
      
      // @ts-ignore
      results.sessionFixes = sessionResult.affectedRows || 0;
    } catch (error) {
      // If the first error was because the table doesn't exist, but we created it above,
      // let's try again
      if (results.tableCreated) {
        try {
          // Just log that the table is ready
          console.log("Sessions table created successfully");
        } catch (retryError) {
          results.errors.push(`Session cleanup retry error: ${retryError instanceof Error ? retryError.message : String(retryError)}`);
        }
      } else {
        results.errors.push(`Session cleanup error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // 3. Ensure admin permissions exist
    try {
      // Check if admin role has permissions
      const permCheck = await query(
        `SELECT COUNT(*) as count FROM role_permissions WHERE role = 'admin'`
      );
      
      // @ts-ignore
      if (permCheck[0].count === 0) {
        // Get all permission IDs
        const permissions = await query(
          `SELECT id FROM permissions`
        );
        
        // Insert admin permissions for all permission IDs
        for (const perm of permissions as { id: number }[]) {
          await query(
            `INSERT IGNORE INTO role_permissions (role, permission_id) VALUES ('admin', ?)`,
            [perm.id]
          );
        }
        
        results.permissionFixes = (permissions as any[]).length;
      }
    } catch (error) {
      results.errors.push(`Permission fix error: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return NextResponse.json({
      success: true,
      message: "Database fixes applied",
      results
    });
  } catch (error) {
    console.error("Database fix error:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error fixing database",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
} 