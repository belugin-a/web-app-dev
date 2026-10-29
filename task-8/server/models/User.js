import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    // Публичный идентификатор пользователя и адрес его профиля.
    // UUID вместо ObjectId: его нельзя «угадать» перебором, и он не выдаёт
    // порядок регистрации. Генерируется на сервере и не меняется.
    _id: {
      type: String,
      default: () => randomUUID(),
    },

    name: {
      type: String,
      required: [true, 'Имя обязательно'],
      trim: true,
      minlength: [1, 'Имя не может быть пустым'],
      maxlength: [60, 'Имя длиннее 60 символов'],
    },

    email: {
      type: String,
      required: [true, 'E-mail обязателен'],
      unique: true,
      lowercase: true,
      trim: true,
      maxlength: [254, 'E-mail длиннее 254 символов'],
      match: [EMAIL_RE, 'Некорректный e-mail'],
    },

    // Хеш никогда не попадает в выборки по умолчанию:
    // passwordHash нужно запросить явно через .select('+passwordHash').
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    about: {
      type: String,
      default: '',
      trim: true,
      maxlength: [500, 'Описание длиннее 500 символов'],
    },

    avatar: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  },
);

userSchema.set('toJSON', {
  transform(doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
