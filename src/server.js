// server.js
// Entry point của ứng dụng backend - nơi khởi động server Express.
//
// Thứ tự khởi động:
//  1. Kết nối MongoDB Atlas
//  2. Khởi tạo Express app với đầy đủ middleware
//  3. Đăng ký routes
//  4. Bắt đầu lắng nghe requests
//  5. Khi process kết thúc (Ctrl+C, crash) → đóng kết nối DB an toàn

/* eslint-disable no-console */
import express from 'express'
import exitHook from 'async-exit-hook'
import helmet from 'helmet'                          // Middleware bảo mật HTTP headers
import rateLimit from 'express-rate-limit'           // Middleware giới hạn số request
import { CONNECT_DB, CLOSE_DB } from '~/config/mongodb'
import { env } from '~/config/environment'
import { APIs_V1 } from '~/routes/v1'
import { errorHandlingMiddleware } from './middlewares/errorHandlingMiddleware'
import cors from 'cors'
import cookieParser from 'cookie-parser'
import { corsOptions } from './config/cors'

/**
 * Cấu hình Rate Limiter toàn cục.
 * Giới hạn mỗi IP chỉ được gửi tối đa 200 requests / 15 phút.
 * Mục đích: ngăn chặn brute force, DDoS cơ bản, spam API.
 */
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // Cửa sổ thời gian: 15 phút (tính bằng milliseconds)
  max: 200,                  // Tối đa 200 requests / window / IP
  standardHeaders: true,     // Trả về headers RateLimit-* (chuẩn RFC 6585)
  legacyHeaders: false,      // Không dùng headers X-RateLimit-* (cũ)
  message: {
    statusCode: 429,
    message: 'Quá nhiều yêu cầu từ IP này, vui lòng thử lại sau 15 phút.'
  }
})

/**
 * Rate Limiter riêng cho auth routes (đăng nhập/đăng ký).
 * Chặt hơn: 20 requests / 15 phút / IP để ngăn brute force mật khẩu.
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 phút
  max: 200,                  // Tăng lên 200 để tiện cho việc test local
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    statusCode: 429,
    message: 'Quá nhiều lần đăng nhập/đăng ký. Vui lòng thử lại sau 15 phút.'
  }
})

const START_SERVER = () => {
  const app = express()

  // ─── Middleware Bảo Mật ───────────────────────────────────────────────────

  // helmet: tự động thêm các HTTP headers bảo mật
  // (Content-Security-Policy, X-Frame-Options, X-XSS-Protection, v.v.)
  app.use(helmet())

  // CORS: cho phép frontend (đã cấu hình whitelist) gọi API
  app.use(cors(corsOptions))

  // Đọc cookies từ request
  app.use(cookieParser())

  // Rate limiting toàn cục: đã tắt theo yêu cầu
  // app.use(globalLimiter)

  // ─── Middleware Parse Body ────────────────────────────────────────────────
  // Parse JSON body (Content-Type: application/json)
  // limit: giới hạn size payload để tránh memory bomb attack
  app.use(express.json({ limit: '10mb' }))

  // ─── Routes ───────────────────────────────────────────────────────────────

  // Áp dụng auth limiter riêng cho các endpoints đăng nhập/đăng ký: đã tắt theo yêu cầu
  // app.use('/v1/auth', authLimiter)

  // Mount tất cả API v1 routes
  app.use('/v1', APIs_V1)

  // ─── Error Handling ───────────────────────────────────────────────────────
  // Phải đặt CUỐI CÙNG sau tất cả routes
  // Express nhận biết error middleware qua 4 params: (err, req, res, next)
  app.use(errorHandlingMiddleware)

  // ─── Start Listening ─────────────────────────────────────────────────────
  if (env.BUILD_MODE === 'production') {
    // Production: dùng PORT từ env (Render/Railway tự inject)
    const server = app.listen(process.env.PORT, '0.0.0.0', () => {
      console.log(`🚀 [PRODUCTION] Server running on Port ${process.env.PORT}`)
    })
    server.on('error', (err) => {
      if (err?.code === 'EADDRINUSE') {
        console.error(`❌ Port ${process.env.PORT} đang bị chiếm. Hãy tắt process đang dùng port đó.`)
        process.exit(1)
      }
      console.error('❌ Server error:', err)
      process.exit(1)
    })
  } else {
    // Development: dùng host/port từ .env local
    const server = app.listen(env.LOCAL_DEV_APP_PORT, env.LOCAL_DEV_APP_HOST, () => {
      console.log(`🚀 [DEV] Server chạy tại http://${env.LOCAL_DEV_APP_HOST}:${env.LOCAL_DEV_APP_PORT}`)
    })
    server.on('error', (err) => {
      if (err?.code === 'EADDRINUSE') {
        console.error(`❌ Port ${env.LOCAL_DEV_APP_PORT} đang bị chiếm. Đổi LOCAL_DEV_APP_PORT trong .env`)
        process.exit(1)
      }
      console.error('❌ Server error:', err)
      process.exit(1)
    })
  }

  // ─── Graceful Shutdown ────────────────────────────────────────────────────
  // Khi process nhận SIGTERM (Docker stop, Ctrl+C) → đóng DB trước khi thoát
  // Tránh: in-flight queries bị kill đột ngột, data corruption
  exitHook(() => {
    console.log('\n🔌 Đang đóng kết nối MongoDB...')
    CLOSE_DB()
    console.log('✅ Đã đóng kết nối MongoDB. Server tắt an toàn.')
  })
}

// ─── Bootstrap ─────────────────────────────────────────────────────────────
// IIFE (Immediately Invoked Function Expression) async:
// Kết nối DB trước → chỉ sau khi thành công mới start server
// Nếu DB lỗi → process.exit(1) để container restart
;(async () => {
  try {
    console.log('🔗 Đang kết nối MongoDB Atlas...')
    await CONNECT_DB()
    console.log('✅ Kết nối MongoDB Atlas thành công!')

    START_SERVER()
  } catch (error) {
    console.error('❌ Không thể kết nối MongoDB:', error)
    process.exit(1) // Exit code 1 = lỗi (Docker/PM2 sẽ tự restart)
  }
})()
