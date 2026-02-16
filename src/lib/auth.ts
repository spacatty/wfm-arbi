import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { db } from "./db";
import { users } from "./db/schema";
import { eq } from "drizzle-orm";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          if (process.env.NODE_ENV === "development") {
            console.log("[Auth] Missing email or password");
          }
          return null;
        }

        const email = credentials.email as string;
        const password = credentials.password as string;

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1);

        if (!user) {
          if (process.env.NODE_ENV === "development") {
            console.log("[Auth] No user found for email:", email);
          }
          return null;
        }

        const isValid = await bcryptjs.compare(password, user.passwordHash);
        if (!isValid) {
          if (process.env.NODE_ENV === "development") {
            console.log("[Auth] Invalid password for:", email);
          }
          return null;
        }

        if (process.env.NODE_ENV === "development") {
          console.log("[Auth] Sign-in success:", user.email);
        }
        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role: string }).role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  trustHost: true,
  debug: process.env.NODE_ENV === "development",
});
