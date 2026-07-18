import * as jwt from 'jsonwebtoken';
import { usersCollection } from '../db/mongoCollections';
import { User, type UserRole } from '../models/user';
import { JWT_SECRET, TOKEN_EXPIRATION } from '../env';

export interface TokenPayload {
  uuid: string;
  username: string;
  role: UserRole;
}

export class AuthHelper {
  /**
   * Hashes a password using Argon2id algorithm
   * @param password The plain text password to hash
   * @returns A promise that resolves to the hashed password
   */
  private static async hashPassword(password: string): Promise<string> {
    return await Bun.password.hash(password, {
      algorithm: 'argon2id',
      memoryCost: 16 * 1024, // 16 MB
      timeCost: 3,
    });
  }

  /**
   * Verifies a password against a stored hash
   * @param password The plain text password to verify
   * @param storedHash The stored hash to compare against
   * @returns A promise that resolves to true if the password matches the hash, false otherwise
   */
  private static async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    return await Bun.password.verify(password, storedHash);
  }

  /**
   * Registers a new user with the given username, password, and role
   * @param username The username for the new user
   * @param password The password for the new user
   * @param role The role for the new user
   * @returns A promise that resolves to the created user object
   * @throws Error if the username is already taken
   */
  public static async register(
    username: string,
    password: string,
    role: UserRole = 'user'
  ): Promise<Omit<User, 'passwordHash' | 'processResult'>> {
    const normalizedUsername = username.trim();

    const existingUser = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${normalizedUsername}$`, 'i') },
    });
    if (existingUser) {
      throw new Error('Username is already taken.');
    }

    const uuid = crypto.randomUUID();
    const passwordHash = await this.hashPassword(password);

    const newUser = new User(uuid, normalizedUsername, passwordHash, role);

    await usersCollection.insertOne(newUser);

    return {
      uuid: newUser.uuid,
      username: newUser.username,
      role: newUser.role,
      elo: newUser.elo,
      eloDeviation: newUser.eloDeviation,
      wins: newUser.wins,
      losses: newUser.losses,
      draws: newUser.draws,
    };
  }

  /**
   * Validates user credentials and returns a signed JWT access token
   * @param username The username of the user to login
   * @param password The password of the user to login
   * @returns A promise that resolves to an object containing the access token and user UUID
   */
  public static async login(
    username: string,
    password: string
  ): Promise<{ token: string; uuid: string }> {
    const normalizedUsername = username.trim();

    const userDoc = await usersCollection.findOne({
      username: { $regex: new RegExp(`^${normalizedUsername}$`, 'i') },
    });
    if (!userDoc) {
      throw new Error('Invalid username or password.');
    }

    const isPasswordValid = await this.verifyPassword(password, userDoc.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid username or password.');
    }

    const token = this.generateToken({
      uuid: userDoc.uuid,
      username: userDoc.username,
      role: userDoc.role,
    });

    return {
      token,
      uuid: userDoc.uuid,
    };
  }

  /**
   * Generates a signed JWT token with the given payload
   * @param payload The payload to include in the JWT token
   * @returns A signed JWT token as a string
   */
  public static generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  }

  /**
   * Verifies a JWT token and returns the decoded payload
   * @param token The JWT token to verify
   * @returns The decoded payload of the JWT token
   */
  public static verifyToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }
}
