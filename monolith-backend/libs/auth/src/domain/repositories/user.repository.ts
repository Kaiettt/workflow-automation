import { User } from '../entities/user.entity';

export abstract class UserRepository {
  abstract findById(id: string): Promise<User | null>;
  abstract findByEmail(email: string): Promise<User | null>;
  abstract create(user: User): Promise<string>;
  abstract update(user: User): Promise<void>;
}
