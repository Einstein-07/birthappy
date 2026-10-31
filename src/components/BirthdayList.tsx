import { CakeButton } from "@/components/CakeButton";
import type { BirthdayPerson } from "@/lib/types";

export function BirthdayList({
  people,
  authenticated
}: {
  people: BirthdayPerson[];
  authenticated: boolean;
}) {
  return (
    <div className="birthday-list">
      {people.map((person, index) => {
        const publicName = person.isAnonymous ? "匿名的朋友" : person.name;
        const avatarSrc = person.hasAvatar
          ? `/api/avatar/${person.id}?v=${encodeURIComponent(person.updatedAt)}`
          : null;

        return (
          <article
            className="birthday-row"
            key={person.id}
            style={{ animationDelay: `${Math.min(index, 8) * 70 + 80}ms` }}
          >
            <div className="birthday-row__avatar avatar">
              {avatarSrc ? (
                <img
                  className="avatar__image"
                  src={avatarSrc}
                  alt={`${publicName}的头像`}
                  width={76}
                  height={76}
                  loading={index > 2 ? "lazy" : "eager"}
                />
              ) : (
                <span className="avatar__blank" aria-hidden="true" />
              )}
            </div>

            <div className="birthday-row__body">
              <div className="birthday-row__heading">
                <h3 className="birthday-row__name">{publicName}</h3>
                <span className="birthday-badge">
                  <span className="birthday-badge__dot" aria-hidden="true" />
                  今天生日
                </span>
                {person.isAnonymous ? (
                  <span className="privacy-tag">匿名</span>
                ) : null}
              </div>
              {person.bio ? (
                <p className="birthday-row__bio">{person.bio}</p>
              ) : null}
            </div>

            <div className="birthday-row__action">
              <CakeButton
                recipientId={person.id}
                recipientName={publicName}
                initialSent={person.hasWished}
                authenticated={authenticated}
              />
            </div>
          </article>
        );
      })}
    </div>
  );
}
