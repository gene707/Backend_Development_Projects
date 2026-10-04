// Server-side validation for contact form submissions
export function validateContactSubmission(req, res, next) {
  const { name, email, message, subject, phone } = req.body;
  const errors = [];

  // Name validation
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    errors.push({ field: 'name', message: 'Name is required' });
  } else if (name.trim().length < 2) {
    errors.push({ field: 'name', message: 'Name must be at least 2 characters long' });
  } else if (name.trim().length > 100) {
    errors.push({ field: 'name', message: 'Name must not exceed 100 characters' });
  }

  // Email validation (RFC 5322 compliant simplified regex)
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
  if (!email || typeof email !== 'string' || email.trim().length === 0) {
    errors.push({ field: 'email', message: 'Email is required' });
  } else if (!emailRegex.test(email.trim())) {
    errors.push({ field: 'email', message: 'Invalid email address format' });
  }

  // Message validation
  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    errors.push({ field: 'message', message: 'Message is required' });
  } else if (message.trim().length < 10) {
    errors.push({ field: 'message', message: 'Message must be at least 10 characters long' });
  } else if (message.trim().length > 3000) {
    errors.push({ field: 'message', message: 'Message must not exceed 3000 characters' });
  }

  // Optional subject length check
  if (subject !== undefined && typeof subject === 'string' && subject.length > 200) {
    errors.push({ field: 'subject', message: 'Subject must not exceed 200 characters' });
  }

  // Optional phone format check
  if (phone !== undefined && phone !== null && phone !== '') {
    const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,20}$/;
    if (typeof phone !== 'string' || !phoneRegex.test(phone.trim())) {
      errors.push({ field: 'phone', message: 'Invalid phone number format' });
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed. Please correct the highlighted errors.',
      errors
    });
  }

  next();
}
