# Pricing Calculator Backend Setup Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed
- MongoDB Atlas account (free tier available)
- Git

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Configuration
Copy `.env.example` to `.env` and update with your values:

```bash
cp .env.example .env
```

**Required Environment Variables:**
```env
# MongoDB Atlas Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/pricing-calculator

# Server Settings
PORT=3001
NODE_ENV=development

# JWT Secret (generate a secure key)
JWT_SECRET=your-super-secret-key-here

# CORS Settings
FRONTEND_URL=http://localhost:3001
```

### 3. MongoDB Atlas Setup

1. **Create Account**: Go to [MongoDB Atlas](https://cloud.mongodb.com/)
2. **Create Cluster**: Choose free tier (M0 Sandbox)
3. **Create Database User**: 
   - Go to Database Access
   - Add New Database User
   - Choose password authentication
   - Give read/write access to any database
4. **Network Access**:
   - Go to Network Access
   - Add IP Address: `0.0.0.0/0` (allow from anywhere)
   - Or add your specific IP for security
5. **Get Connection String**:
   - Go to Clusters → Connect → Connect your application
   - Copy connection string
   - Replace `<username>`, `<password>`, and `<dbname>` in your `.env` file

### 4. Start the Server
```bash
# Development mode (with auto-restart)
npm run dev

# Production mode
npm start
```

### 5. Test the Setup
- Open browser to `http://localhost:3001`
- Your calculator should load with backend functionality
- Test API health: `http://localhost:3001/api/health`

## 🔧 API Endpoints

### Quotes API
```
GET    /api/quotes              - List quotes (with pagination/filtering)
GET    /api/quotes/recent       - Get recent quotes
GET    /api/quotes/stats        - Get quote statistics
GET    /api/quotes/:id          - Get specific quote
POST   /api/quotes              - Create new quote
PUT    /api/quotes/:id          - Update quote
DELETE /api/quotes/:id          - Delete quote
POST   /api/quotes/:id/duplicate - Duplicate quote
GET    /api/quotes/:id/export   - Export quote data
```

### Invoices API
```
GET    /api/invoices                    - List invoices
GET    /api/invoices/recent             - Get recent invoices
GET    /api/invoices/overdue            - Get overdue invoices
GET    /api/invoices/stats              - Get invoice statistics
GET    /api/invoices/:id                - Get specific invoice
POST   /api/invoices                    - Create new invoice
POST   /api/invoices/from-quote/:id     - Create invoice from quote
PUT    /api/invoices/:id                - Update invoice
POST   /api/invoices/:id/payments       - Add payment to invoice
DELETE /api/invoices/:id               - Delete invoice
GET    /api/invoices/:id/export         - Export invoice data
```

### Authentication API
```
POST   /api/auth/login          - Login (simple auth)
POST   /api/auth/logout         - Logout
GET    /api/auth/me             - Get current user info
```

## 🛠️ Development

### Project Structure
```
/
├── server.js              # Main server file
├── package.json           # Dependencies
├── .env                   # Environment variables
├── models/                # Database models
│   ├── Quote.js
│   └── Invoice.js
├── routes/                # API routes
│   ├── quotes.js
│   ├── invoices.js
│   └── auth.js
├── frontend-api.js        # Frontend API integration
└── working calculator...  # Your existing calculator
```

### Database Models

**Quote Schema:**
- Customer information
- Project details
- Address information
- Printing items (2 items max)
- Shadecloth details
- Setup configuration
- Calculations (stored for history)
- Metadata (created by, tags, notes)

**Invoice Schema:**
- Links to quotes
- Customer information (copied for history)
- Line items
- Payment tracking
- Production status
- Financial totals

### Adding New Features

1. **New API Endpoint**: Add to appropriate route file
2. **Database Changes**: Update model schemas
3. **Frontend Integration**: Add functions to `frontend-api.js`
4. **Update HTML**: Include the new JavaScript file

## 🌐 Cloud Deployment

### Option 1: Railway (Recommended)
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login and deploy
railway login
railway init
railway up
```

### Option 2: Heroku
```bash
# Install Heroku CLI
# Create Heroku app
heroku create your-app-name

# Set environment variables
heroku config:set MONGODB_URI=your-connection-string
heroku config:set JWT_SECRET=your-secret-key
heroku config:set NODE_ENV=production

# Deploy
git push heroku main
```

### Option 3: DigitalOcean App Platform
1. Connect your GitHub repository
2. Set environment variables in dashboard
3. Deploy automatically

## 🔒 Security Considerations

### For Production:
1. **Environment Variables**: Never commit `.env` to version control
2. **JWT Secret**: Use a strong, randomly generated secret
3. **Database Access**: Restrict MongoDB network access to your server IPs
4. **HTTPS**: Enable SSL/TLS in production
5. **Rate Limiting**: Already included in the server setup
6. **Input Validation**: Models include validation rules
7. **CORS**: Configure properly for your domain

### Authentication Upgrade:
The current auth system is basic. For production, consider:
- Proper password hashing with bcrypt
- JWT token expiration and refresh
- Role-based access control
- User management interface

## 🧪 Testing

### Manual Testing:
1. **Save Quote**: Fill form and click "Save Quote"
2. **Load Quote**: Click "Load Quote" and select from list
3. **Export/Import**: Test file export and import
4. **API Health**: Visit `/api/health` endpoint

### API Testing with curl:
```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Create a quote
curl -X POST http://localhost:3001/api/quotes \
  -H "Content-Type: application/json" \
  -d '{"quoteName":"Test Quote","customer":{"companyName":"Test Co","contactPerson":"John Doe"}}'

# Get recent quotes
curl http://localhost:3001/api/quotes/recent
```

## 🆘 Troubleshooting

### Common Issues:

1. **MongoDB Connection Failed**
   - Check connection string format
   - Verify database user credentials
   - Confirm network access settings

2. **Port Already in Use**
   - Change PORT in `.env` file
   - Kill existing process: `lsof -ti:3001 | xargs kill`

3. **CORS Errors**
   - Check FRONTEND_URL in `.env`
   - Ensure it matches your browser URL

4. **Module Not Found**
   - Run `npm install` to install dependencies
   - Check Node.js version (18+ required)

### Logs:
- Server logs show in terminal
- MongoDB connection status displayed on startup
- API errors logged with details

## 📞 Support

For issues with this setup:
1. Check the troubleshooting section
2. Review server logs for error details
3. Verify environment variables
4. Test API endpoints individually

The backend provides a robust foundation for your pricing calculator with cloud storage, search capabilities, and professional quote/invoice management.