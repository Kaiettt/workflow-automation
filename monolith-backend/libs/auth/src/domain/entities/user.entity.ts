import { UserRole } from '../enums/user-role.enum';
import * as bcrypt from 'bcryptjs';

export interface UserProps {
  id?: string;
  email: string;
  passwordHash: string;
  name: string;
  role?: UserRole;
  isActive?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export class User {
  private readonly _id?: string;
  private _email: string;
  private _passwordHash: string;
  private _name: string;
  private _role: UserRole;
  private _isActive: boolean;
  private readonly _createdAt?: Date;
  private _updatedAt?: Date;

  private constructor(props: UserProps) {
    this._id = props.id;
    this._email = props.email.toLowerCase().trim();
    this._passwordHash = props.passwordHash;
    this._name = props.name.trim();
    this._role = props.role ?? UserRole.DEVELOPER;
    this._isActive = props.isActive ?? true;
    this._createdAt = props.createdAt;
    this._updatedAt = props.updatedAt;
  }

  public static create(props: UserProps): User {
    if (!props.email || !props.email.includes('@')) {
      throw new Error('Invalid email address');
    }
    if (!props.name || props.name.trim().length === 0) {
      throw new Error('Name cannot be empty');
    }
    return new User(props);
  }

  public get id(): string | undefined {
    return this._id;
  }

  public get email(): string {
    return this._email;
  }

  public get passwordHash(): string {
    return this._passwordHash;
  }

  public get name(): string {
    return this._name;
  }

  public get role(): UserRole {
    return this._role;
  }

  public get isActive(): boolean {
    return this._isActive;
  }

  public get createdAt(): Date | undefined {
    return this._createdAt;
  }

  public get updatedAt(): Date | undefined {
    return this._updatedAt;
  }

  public async validatePassword(plainPassword: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, this._passwordHash);
  }

  public deactivate(): void {
    this._isActive = false;
  }

  public activate(): void {
    this._isActive = true;
  }

  public changeRole(newRole: UserRole): void {
    this._role = newRole;
  }

  public changePassword(newPasswordHash: string): void {
    this._passwordHash = newPasswordHash;
    this._updatedAt = new Date();
  }
}
