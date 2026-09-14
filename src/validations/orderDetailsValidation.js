import Joi from 'joi'
import { StatusCodes } from 'http-status-codes'
import ApiError from '~/utils/ApiError'
import { OBJECT_ID_RULE, OBJECT_ID_RULE_MESSAGE } from '~/utils/validatiors'

const createNew = async (req, res, next) => {
  const correctCondition = Joi.object({
    orderId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE).required(),
    productId: Joi.string().pattern(OBJECT_ID_RULE).message(OBJECT_ID_RULE_MESSAGE).required(),
    quantity: Joi.number().integer().min(1).required().messages({
      'number.base': '"quantity" phải là số.',
      'number.integer': '"quantity" phải là số nguyên.',
      'number.min': '"quantity" phải lớn hơn hoặc bằng 1.',
      'any.required': '"quantity" là bắt buộc.'
    }),
    price: Joi.number().min(0).required().messages({
      'number.base': '"price" phải là số.',
      'number.min': '"price" phải lớn hơn hoặc bằng 0.',
      'any.required': '"price" là bắt buộc.'
    })
  })

  try {
    await correctCondition.validateAsync(req.body, { abortEarly: false })
    next()
  } catch (error) {
    next(new ApiError(StatusCodes.UNPROCESSABLE_ENTITY, new Error(error).message))
  }
}

export const orderDetailsValidation = {
  createNew
}
