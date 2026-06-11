import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
dotenv.config()

const app = express()
app.use(cors({ origin: '*' }))
app.use(express.json())

// Routes will be added in later steps
import trainRoutes from './routes/trains.js'
import weatherRoutes from './routes/weather.js'
import copilotRoutes from './routes/copilot.js'

app.use('/api/trains', trainRoutes)
app.use('/api/weather', weatherRoutes)
app.use('/api/copilot', copilotRoutes)

app.listen(3001, () => console.log('RailTwin API on :3001'))