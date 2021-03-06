import { MongoClient, Collection, Cursor } from 'mongodb';
import { Config } from 'src/Config';
import { from, iif, Observable, of } from 'rxjs';
import { map, switchMap, tap } from 'rxjs/operators';
import { DataStructure } from '@typings/typings/DataStructure';

export class Mongo extends MongoClient {
	private DB_NAME = '7tv';
	private static instance: Mongo;
	static Get(): Mongo {
		return this.instance ?? (this.instance = new Mongo());
	}

	constructor() {
		super(Config.mongo_uri, { useUnifiedTopology: true });

		Mongo.instance = this;
		// Connect to the database
		this.connect(err => {
			if (err) return console.error(`Could not connect to MongoDB: ${err}`);
			console.log(`<DB> Connected`);

			this.initializeChangeStream();
		});
	}

	createChangeStreamCandidacy(): Observable<void> {
		return of(undefined);
	}

	private initializeChangeStream(): void {
		const stream = super.db(this.DB_NAME).watch(undefined, { fullDocument: 'updateLookup' });

		// stream.on('change', change => console.log('Penis', change));
	}

	/**
	 * Get a collection within the database
	 */
	collection<T>(name: string): Observable<Collection<T>>;
	collection<T extends DataStructure.TwitchUser>(name: 'users'): Observable<Collection<T>>;
	collection<T extends DataStructure.Role>(name: 'roles'): Observable<Collection<T>>;
	collection<T extends DataStructure.AuditLog.Entry>(name: 'audit'): Observable<Collection<T>>;
	collection<T extends DataStructure.Ban>(name: 'bans'): Observable<Collection<T>>;
	collection<T extends DataStructure.Emote>(name: 'emotes'): Observable<Collection<T>>;
	collection<T extends DataStructure.BearerToken>(name: 'oauth'): Observable<Collection<T>>;
	collection<T>(name: string): Observable<Collection<T>> {
		return new Observable<Collection<T>>(observer => {
			of(this.db(this.DB_NAME)).pipe(
				map(db => ({ // Get existing collections. We will use this data to determine whether the desired collection is missing
					collections: db.listCollections({ name }, { nameOnly: true }),
					db
				})),
				switchMap(({ db, collections }) => from(collections.toArray()).pipe( // Transform listCollections result to string[]
					map(colArray => ({ db, collections: colArray.map(o => o.name) as string[] }))
				)),
				switchMap(({ collections, db }) => iif(() => collections.includes(name), // Check if the collection exists
					of(db.collection(name)), // Collection exists: emit it
					of(undefined).pipe(
						switchMap(() => from(db.createCollection(name)).pipe( // If it doesn't exist, create collection
							tap(() => console.log(`<DB> Created collection ${name}`))
						))
					)
				))
			).subscribe({
				next(col) { observer.next(col); },
				error(err) { observer.error(err); },
				complete() { observer.complete(); },
			});
		});
	}
}

export namespace Mongo {
	export const Cache = <T extends Cursor>(cursor: T) => {
		const query = (cursor as Cursor & { [key: string]: any })['cmd']['query'];

		return cursor;
	};
}
