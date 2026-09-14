// usersModel.js
// Model layer xử lý tất cả thao tác CRUD với collection 'users' trong MongoDB.
//
// Model chỉ:
//  - Validate dữ liệu (Joi schema)
//  - Thao tác với DB (insert, find, update, delete)
//  - KHÔNG chứa business logic (để ở Service)

import Joi from 'joi'
import { ObjectId } from 'mongodb'
import { GET_DB } from '~/config/mongodb'

const USERS_COLLECTION_NAME = 'users'

// Schema định nghĩa cấu trúc và quy tắc validate dữ liệu user
// Joi schema đảm bảo data integrity ở tầng DB, dù validation ở tầng API có lỗi
const USERS_COLLECTION_SCHEMA = Joi.object({
  // Fix: min(2) để đồng bộ với frontend validation (trước đây backend min(3) nhưng frontend min(2))
  // → User nhập 2 ký tự sẽ pass frontend nhưng bị reject ở backend → trải nghiệm xấu
  name: Joi.string().min(2).max(100).required(),

  email: Joi.string().email().required(),

  // Password có thể rỗng hoặc null nếu đăng nhập bằng Google
  password: Joi.string().min(10).allow('', null).optional(),

  role: Joi.string().valid('customer', 'admin').default('customer'),

  // Thêm provider để phân biệt nguồn tạo tài khoản
  provider: Joi.string().valid('local', 'google').default('local'),

  // imageUrl: tùy chọn
  imageUrl: Joi.string().optional().allow(''), // allow('') vì có thể là empty string
  phone: Joi.string().optional().allow(''),
  address: Joi.string().optional().allow(''),

  refreshToken: Joi.string().allow(null, '').default(null),

  createdAt: Joi.date().default(() => new Date()),
  updatedAt: Joi.date().default(() => new Date())
})

/**
 * Validate data trước khi tạo user mới.
 * abortEarly: false → trả về TẤT CẢ lỗi, không dừng ở lỗi đầu tiên
 */
const validateBeforeCreate = async (data) =>
  USERS_COLLECTION_SCHEMA.validateAsync(data, { abortEarly: false })

/**
 * Tạo user mới trong DB.
 * @param {Object} data - Thông tin user
 * @returns {Object} Kết quả insertOne từ MongoDB (chứa insertedId)
 */
const createNew = async (data) => {
  const validData = await validateBeforeCreate(data)
  return await GET_DB().collection(USERS_COLLECTION_NAME).insertOne(validData)
}

/**
 * Lấy tất cả users.
 * Chỉ admin mới được gọi endpoint này (kiểm tra ở middleware/service).
 * @returns {Array} Danh sách tất cả users
 */
const getAll = async () => {
  return await GET_DB().collection(USERS_COLLECTION_NAME).find({}).toArray()
}

/**
 * Tìm user theo MongoDB ObjectId.
 * @param {string} id - ID dạng string (24 ký tự hex)
 * @returns {Object|null} User document hoặc null
 */
const findById = async (id) => {
  return await GET_DB().collection(USERS_COLLECTION_NAME).findOne({ _id: new ObjectId(id) })
}

/**
 * Tìm user theo email.
 * Dùng khi đăng nhập và kiểm tra trùng email khi đăng ký.
 * @param {string} email - Email cần tìm
 * @returns {Object|null} User document hoặc null
 */
const findByEmail = async (email) => {
  return await GET_DB().collection(USERS_COLLECTION_NAME).findOne({ email })
}

/**
 * Cập nhật thông tin user.
 * Tự động cập nhật updatedAt để tracking thời gian sửa đổi.
 * @param {string} id - User ID
 * @param {Object} data - Các field cần cập nhật (partial update)
 * @returns {Object} Kết quả updateOne từ MongoDB
 */
const updateById = async (id, data) => {
  const update = {
    $set: {
      ...data,
      updatedAt: new Date() // Luôn cập nhật timestamp khi có thay đổi
    }
  }
  return await GET_DB().collection(USERS_COLLECTION_NAME).updateOne({ _id: new ObjectId(id) }, update)
}

/**
 * Xoá user theo ID (hard delete).
 * @param {string} id - User ID
 * @returns {Object} Kết quả deleteOne từ MongoDB
 */
const deleteById = async (id) => {
  return await GET_DB().collection(USERS_COLLECTION_NAME).deleteOne({ _id: new ObjectId(id) })
}

export const usersModel = {
  createNew,
  getAll,
  findById,
  findByEmail,
  updateById,
  deleteById
}