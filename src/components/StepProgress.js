import { Steps } from 'antd'
import { CheckOutlined } from '@ant-design/icons'

function StepProgress({ currentStep, completedSteps }) {
  const steps = [
    {
      title: 'Deposit',
      description: 'Deposit tokens with secret',
    },
    {
      title: 'Swap',
      description: 'Exchange your tokens',
    },
    {
      title: 'Withdraw',
      description: 'Withdraw to destination',
    }
  ]

  return (
    <div style={{ 
      width: '100%', 
      maxWidth: '800px', 
      margin: '20px auto',
      padding: '0 20px'
    }}>
      <Steps
        current={currentStep}
        items={steps.map((step, index) => ({
          ...step,
          status: completedSteps.includes(index) ? 'finish' : 
                 index === currentStep ? 'process' : 'wait',
          icon: completedSteps.includes(index) ? 
            <CheckOutlined style={{ color: '#52c41a' }} /> : undefined
        }))}
      />
    </div>
  )
}

export default StepProgress