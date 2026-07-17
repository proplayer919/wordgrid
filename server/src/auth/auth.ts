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
   * Hashes a password using Bun's native password hashing engine.
   * Defaults to Argon2id, which is structurally superior to bcrypt.
   */
  private static async hashPassword(password: string): Promise<string> {
    return await Bun.password.hash(password, {
      algorithm: 'argon2id',
      memoryCost: 65536,
      timeCost: 3,
    });
  }

  /**
   * Verifies a password against a stored hash
   */
  private static async verifyPassword(password: string, storedHash: string): Promise<boolean> {
    return await Bun.password.verify(password, storedHash);
  }

  /**
   * Registers a new user account if the username is available
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
   * Generates a signed JWT with the payload
   */
  public static generateToken(payload: TokenPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRATION });
  }

  /**
   * Verifies an incoming JWT token and returns its decoded payload
   */
  public static verifyToken(token: string): TokenPayload {
    return jwt.verify(token, JWT_SECRET) as TokenPayload;
  }
}
