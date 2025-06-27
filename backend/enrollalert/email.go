package enrollalert

import (
	"context"
	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/service/sesv2"
	sestypes "github.com/aws/aws-sdk-go-v2/service/sesv2/types"
)

type EmailClient struct {
	svc  *sesv2.Client
	from string
	alertTemplate string
}

// cretes SES email client
func NewEmailClient(ctx context.Context, from string, alertTemplate string) (*EmailClient, error) {

	cfg, err := config.LoadDefaultConfig(ctx)
	if err != nil {
		return nil, err
	}

	return &EmailClient{svc: sesv2.NewFromConfig(cfg), from: from, alertTemplate: alertTemplate,}, nil
}

// sends alert email to user using SES client
func (c *EmailClient) Send(to, data map[string]interface{}) error {
	
	payload, _ := json.Marshal(data)

	_, err := c.svc.SendEmail(context.TODO(), &sesv2.SendEmailInput{
		FromEmailAddress: aws.String(c.from),
		Destination:      &sestypes.Destination{ToAddresses: []string{to}},
		Content: &sestypes.EmailContent{
			Template: &sestypes.Template{
				TemplateName: aws.String(c.alertTemplate),
				TemplateData: aws.String(string(payload)),
			},
		},
	})

	return err
}

