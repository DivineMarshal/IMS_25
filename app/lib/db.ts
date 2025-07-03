import mysql from "mysql2/promise";

// Create a connection pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || "db-9f47c544-517c-4ac3-9bef-32b7fa5b92fa.ap-southeast-1.public.db.laravel.cloud",
  port: parseInt(process.env.DB_PORT || "3306"),
  user: process.env.DB_USERNAME || "kbdjmhn1td0hwux4",
  password: process.env.DB_PASSWORD || "TKh0TMeM6azI2VIaB9NM",
  database: process.env.DB_DATABASE || "main",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Export a function to get a connection from the pool
export async function getConnection() {
  try {
    const connection = await pool.getConnection();
    return connection;
  } catch (error) {
    console.error("Error connecting to the database:", error);
    throw error;
  }
}

// Export a function to execute queries
export async function query(
  sql: string,
  params: (string | number | boolean | null)[] = []
) {
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (error) {
    console.error("Error executing query:", error);
    throw error;
  }
}

// Export the pool for direct access if needed
export default pool;
