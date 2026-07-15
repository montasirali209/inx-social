const router=require('express').Router();
const c=require('../controllers/authController');
const {requireAuth}=require('../middleware/authMiddleware');
router.post('/register',c.register);router.post('/verify-email',c.verifyEmail);router.post('/resend-verification',c.resendVerification);router.post('/login',c.login);router.post('/forgot-password',c.forgotPassword);router.post('/reset-password',c.resetPassword);router.get('/me',requireAuth,c.me);module.exports=router;
