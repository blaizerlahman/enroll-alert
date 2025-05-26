package enrollalert

import (
	"time"
	"fmt"
	"strings"
	"github.com/go-rod/rod"
	"github.com/go-rod/rod/lib/launcher"
)

func scrape() {
	//visible browser
	url := launcher.New().Headless(false).MustLaunch()
	browser := rod.New().ControlURL(url).MustConnect()
	defer browser.MustClose()
	fmt.Println("beginning scrape")

	pageURL := "https://public.enroll.wisc.edu/search?term=1262&keywords=comp%20sci%20300"
	page := browser.MustPage(pageURL)

	time.Sleep(4 * time.Second)

	// selecting course
	page.MustElementByJS(` () => {
		const elements = Array.from(document.querySelectorAll(".left.grow.catalog"));
		return elements.find(el => el.textContent.trim().toLowerCase() === "comp sci 300");
	}`).MustClick()
	page.MustWaitLoad()

	time.Sleep(3 * time.Second)

	// viewing sections
	page.MustElementByJS(` () => {
		const elements = Array.from(document.querySelectorAll("span"));
		return elements.find(el => /see sections/i.test(el.textContent));
	}`).MustClick()
	page.MustWaitLoad()

	time.Sleep(3 * time.Second)

	//page.MustElement(".ng-star-inserted")

	// res := page.MustEval(` () => {
	// 	return Array.from(document.querySelectorAll(".ng-star-inserted"))
	// 		.map(el => el.textContent.trim());
	// }`)


	elements := page.MustElements(".ng-star-inserted")

	for _, el := range elements {
		text := strings.TrimSpace(el.MustText())
		if text != "" {
			fmt.Println(text)
		}
	}
	// values := res.value.([]interface{})
	// var text []string
	//
	// for _, t := range values {
	// 	text = append(text, t.(string))
	// }
	//
	// for _, t := range text {
	// 	fmt.Println(t)
	// }

	// items := page.MustElements("ng-star-inserted")
	//
	// for _, item := range items {
	// 	text := item.MustText()
	// 	fmt.Println(text)
	//
	// 	if strings.Contains(text, "Currently enrolled:") {
	// 		enrolledText := strings.TrimSpace(text)
	// 		parts := strings.Split(enrolledText, ":")
	// 		if len(parts) == 2 {
	// 			enrolled := strings.TrimSpace(parts[1])
	// 			fmt.Println("Currently enrolled: ", enrolled)
	// 		} else {
	// 			fmt.Println("Expected length: 2\nActual length: %d", len(parts))
	// 		}
	// 	}
	// }
}
