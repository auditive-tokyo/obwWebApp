import { Amplify } from 'aws-amplify'
import { amplifyConfig } from './amplify-config'

// Configure Amplify as early as possible, before any other module uses Amplify
Amplify.configure(amplifyConfig)
