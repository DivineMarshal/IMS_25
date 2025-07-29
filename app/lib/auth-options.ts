// app/lib/auth-options.ts
import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { compare } from "bcrypt";
import { query } from "@/app/lib/db";

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error("Username and password are required");
        }

        // Find user by username
        const users = (await query(
          `
          SELECT 
            u.id, u.username, u.password, u.email, u.role, 
            u.is_active, d.Department_ID as department_id, d.Department_Name as department_name
          FROM users u
          LEFT JOIN department d ON u.department_id = d.Department_ID
          WHERE u.username = ? AND u.is_active = true
          LIMIT 1
        `,
          [credentials.username]
        )) as any[];

        const user = users[0];

        if (!user) {
          throw new Error("User not found");
        }

        // Verify password
        const passwordMatch = await compare(
          credentials.password,
          user.password
        );

        if (!passwordMatch) {
          throw new Error("Invalid password");
        }

        // Update last login time
        await query(
          `
          UPDATE users 
          SET last_login = CURRENT_TIMESTAMP
          WHERE id = ?
        `,
          [user.id]
        );

        return {
          id: user.id.toString(),
          name: user.username,
          email: user.email,
          role: user.role,
          departmentId: user.department_id,
          departmentName: user.department_name,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.departmentId = user.departmentId;
        token.departmentName = user.departmentName;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user.id = token.id;
        session.user.role = token.role;
        session.user.departmentId = token.departmentId;
        session.user.departmentName = token.departmentName;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },
  secret: process.env.NEXTAUTH_SECRET,
};
