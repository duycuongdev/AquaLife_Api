import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'

const userSchema = Joi.object({
  name: Joi.string().min(2).max(100).required().messages({
    'string.base': '"name" phải là chuỗi.',
    'string.empty': '"name" không được để trống.',
    'string.min': '"name" tối thiểu {#limit} ký tự.',
    'string.max': '"name" tối đa {#limit} ký tự.',
    'any.required': '"name" là bắt buộc.'
  }),
  email: Joi.string().email().required().messages({
    'string.email': '"email" không hợp lệ.',
    'any.required': '"email" là bắt buộc.'
  }),
  password: Joi.string().min(10).max(128).required().messages({
    'string.min': '"password" tối thiểu {#limit} ký tự.',
    'any.required': '"password" là bắt buộc.'
  }),
  role: Joi.string().valid('customer', 'admin').optional(),
  imageUrl: Joi.string().optional().allow(''),
  phone: Joi.string().optional().allow(''),
  address: Joi.string().optional().allow(''),
  otp: Joi.string().length(6).required().messages({
    'string.length': '"otp" phải gồm 6 ký tự.',
    'any.required': '"otp" là bắt buộc.'
  })
})

const createNew = async (req, res, next) => {
  try {
    await userSchema.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const updateById = async (req, res, next) => {
  const updateSchema = Joi.object({
    name: Joi.string().min(2).max(100).optional(),
    email: Joi.string().email().optional(),
    password: Joi.string().min(10).max(128).optional(),
    role: Joi.string().valid('customer', 'admin').optional(),
    imageUrl: Joi.string().optional().allow(''),
    phone: Joi.string().optional().allow(''),
    address: Joi.string().optional().allow('')
  })
  try {
    await updateSchema.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const login = async (req, res, next) => {
  const loginSchema = Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
  try {
    await loginSchema.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

const sendOtp = async (req, res, next) => {
  const schema = Joi.object({
    email: Joi.string().email().required()
  })
  try {
    await schema.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const userValidation = {
  createNew,
  updateById,
  login,
  sendOtp
}