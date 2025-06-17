
import Image from "next/image"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Github } from "lucide-react"

export default function AboutPage() {
  return (
    <div className="pt-24 px-6 space-y-12 max-w-3xl mx-auto">
      <section className="flex flex-col items-center space-y-4">
        <h1 className="text-4xl font-bold">About</h1>
        <h1 className="text-l font-semibold">
          No more constantly checking Search & Enroll!
        </h1>
        <p>
          EnrollAlert gives UW-Madison students peace of mind by allowing them to 
          track real-time enrollment status for their courses and get notified when
          seats become available. 
          <strong> All it takes is an email and a click! </strong>
          Course section information is updated along with UW Course Search & Enroll,
          so you will receive notifications as soon as seats open up. 
        </p>

        <hr className="border-t border-gray-200 my-12 w-full" />

        <h1 className="text-3xl font-bold">Feedback</h1>
        <p>
          Feedback is welcome! This website is a work in progress and is built by one
          CS student, so it is by no means perfect and improvements can always be made.
          If you have any feedback, bug fixes, feature suggestions, or anything else,
          please feel free to fill out a feedback form.
        </p>
        <Button asChild>
          <Link 
            href="https://form.jotform.com/251638644266161" 
            target="_blank"
            rel="noopener noreferrer"
          >
            Give Feedback
          </Link>
        </Button>

        <hr className="border-t border-gray-200 my-12 w-full" />

        {// TODO: add stripe functionality once site is live
        }
        <h1 className="text-3xl font-bold">Support</h1>
        <p>
          If you feel like this site has helped you and you would like to contribute to
          it continuing to help others, your donation would be greatly appreciated. Any 
          money the site receives will go towards future hosting costs to keep it running.
        </p>
        <Button>Donate</Button>
      </section>

      <footer className="mt-16 border-t pt-6 flex flex-wrap flex-row justify-center items-center space-x-4 pb-12">
        <Image
          src="/enrollalert_logo.png"
          alt="EnrollAlert logo"
          width={40}
          height={40}
        />
        <p className="text-sm">
          Created by{" "}
          <Link
            href="https://www.linkedin.com/in/blaizelahman"
            className="underline"
            target="_blank"
          >
            Blaize Lahman
          </Link>
        </p>
        <Link href="https://github.com/blaizerlahman" target="_blank">
          <Github className="size-6" />
        </Link>
        <p className="w-full text-center mt-4">
          Unaffiliated with UW-Madison
        </p>
      </footer>
    </div>
  )
}

