import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Github } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="pt-24 px-6 space-y-12 max-w-3xl mx-auto">
      <section className="flex flex-col items-center space-y-4">
        <h1 className="text-4xl font-bold text-red-700">About</h1>
        <h2 className="text-lg font-semibold">
          No more constantly checking Search & Enroll!
        </h2>
        <p>
          EnrollAlert gives UW-Madison students peace of mind by allowing them to 
          track real-time enrollment status for their courses and get notified when
          seats become available.&nbsp;
          <strong>All it takes is an email and a click! </strong>
          Course section information is updated along with UW Course Search & Enroll,
          so you will receive notifications as soon as seats open up.
        </p>

        <hr className="border-t border-red-200 my-12 w-full" />

        <h3 className="text-3xl font-bold text-red-700">Feedback</h3>
        <p>
          Feedback is welcome! This website is a work in progress and is built by one
          CS student, so it is by no means perfect and improvements can always be made.
          If you have any feedback, bug fixes, feature suggestions, or anything else,
          please feel free to fill out a feedback form.
        </p>
        <Button className="bg-red-600 text-white hover:bg-red-700">
          <Link 
            href="https://form.jotform.com/251638644266161" 
            target="_blank"
            rel="noopener noreferrer"
          >
            Give Feedback
          </Link>
        </Button>

        <hr className="border-t border-red-200 my-12 w-full" />

        <h3 className="text-3xl font-bold text-red-700">Support</h3>
        <p>
          If you feel like this site has helped you and you would like to contribute to
          continue helping others, your donation would be greatly appreciated. Any 
          money the site receives will go directly towards future hosting costs to keep it running.
        </p>
        <Button asChild className="bg-red-600 text-white hover:bg-red-700">
          <Link
            href="https://buy.stripe.com/28EeVe9Q8cUWbP89dI4ko00"
            target="_blank"
            rel="noopener noreferrer"
          >
            Donate
          </Link>
        </Button>
      </section>

      <footer className="mt-16 border-t border-red-200 pt-6 flex flex-wrap justify-center items-center space-x-4 pb-12">
        <Image
          src="/enrollalert_logo_transparent.png"
          alt="EnrollAlert logo"
          width={40}
          height={40}
        />
        <p className="text-sm">
          Created by{" "}
          <Link
            href="https://www.linkedin.com/in/blaizelahman"
            className="underline text-red-600"
            target="_blank"
            rel="noopener noreferrer"
          >
            Blaize Lahman
          </Link>
        </p>
        <Link href="https://github.com/blaizerlahman" target="_blank">
          <Github className="size-6 text-red-600" />
        </Link>
        <p className="w-full text-center mt-4 text-red-500">
          Unaffiliated with UW-Madison
        </p>
      </footer>
    </div>
  )
}

